-- Migration: caregiver_availability
-- Purpose: caregiver availability and the availability filter (slice S-04):
--   * public.caregiver_availability     - weekly time slots a caregiver is available in (readable by anon)
--   * public.save_caregiver_profile()   - also replaces the caller's availability (new p_availability parameter)
--   * public.search_caregivers()        - optional availability filter (new p_availability parameter) and an
--                                         availability column
--   * public.get_public_caregiver()     - availability column
-- Decisions (S-04):
--   * A slot is '<day>-<part>': day in pon wt sr czw pt sob nd, part in rano popoludnie wieczor noc (28 slots,
--     e.g. 'pon-rano', 'sob-noc'). The same string is the table row, the RPC/API array element and the URL value.
--     A CHECK constraint guards the 28 slots; labels and the canonical order (pon..nd, rano..noc) live in the app.
--   * 'noc' is the night that starts on the given day at 22:00 and ends at 06:00 the next day.
--   * The filter is OR: a profile matches when it has at least one of the selected slots. Ranking by the number of
--     covered slots is a later slice (S-05).
--   * Availability is optional and informational, not a booking (PRD Non-Goals). It is NOT part of the completeness
--     rule (caregiver_profile_missing() is unchanged), so profiles without availability stay visible on the list
--     and hide only while an availability filter is active.
--   * Deployment order: this migration first (supabase db push), then the Worker (wrangler deploy). The new
--     parameters have defaults (p_availability default '{}' in save_caregiver_profile(), default null in
--     search_caregivers()), and PostgREST calls functions by parameter name, so the old Worker keeps working in the
--     window between the two steps. A save from the old Worker in that window clears the caller's availability,
--     which nobody has yet.
-- Changing a function's parameters or result columns needs drop + create (create or replace cannot change the
-- signature or "returns table"), so the three functions are dropped, recreated and granted again. Nothing else in
-- the database depends on them. No data changes: existing profiles get an empty availability.
-- Table privileges follow 20261103230000_table_grants_mirror_policies.sql. Resulting matrix (24 rows):
--   services, gminas        - anon: select;  authenticated: select
--   accounts                - authenticated: select
--   caregiver_profiles      - anon: select;  authenticated: select, insert, update
--   caregiver_contacts      - authenticated: select, insert, update
--   caregiver_gminas        - anon: select;  authenticated: select, insert, delete
--   caregiver_services      - anon: select;  authenticated: select, insert, delete
--   caregiver_availability  - anon: select;  authenticated: select, insert, delete   (new, 4 rows)

-- ---------------------------------------------------------------------------
-- Availability of a caregiver: one row per weekly slot. Rows are replaced, never updated (no update policy).
-- ---------------------------------------------------------------------------
create table public.caregiver_availability (
  caregiver_id uuid not null references public.caregiver_profiles (user_id) on delete cascade,
  slot text not null check (slot ~ '^(pon|wt|sr|czw|pt|sob|nd)-(rano|popoludnie|wieczor|noc)$'),
  primary key (caregiver_id, slot)
);

create index caregiver_availability_slot_idx on public.caregiver_availability (slot);

comment on table public.caregiver_availability is
  'Weekly time slots in which a caregiver is available. Public. Optional and informational (not a booking); not part of the profile completeness rule.';
comment on column public.caregiver_availability.slot is
  '<day>-<part>: day in pon, wt, sr, czw, pt, sob, nd; part in rano (6-12), popoludnie (12-18), wieczor (18-22), noc (22-6, the night that starts on the given day and ends the next morning).';

alter table public.caregiver_availability enable row level security;

create policy caregiver_availability_select_anon on public.caregiver_availability
  for select to anon
  using (true);

create policy caregiver_availability_select_authenticated on public.caregiver_availability
  for select to authenticated
  using (true);

create policy caregiver_availability_insert_authenticated on public.caregiver_availability
  for insert to authenticated
  with check (caregiver_id = (select auth.uid()));

create policy caregiver_availability_delete_authenticated on public.caregiver_availability
  for delete to authenticated
  using (caregiver_id = (select auth.uid()));

-- Supabase grants ALL (including TRUNCATE) by default: revoke, then grant exactly what the policies allow.
revoke all on public.caregiver_availability from anon, authenticated;
grant select on public.caregiver_availability to anon;
grant select, insert, delete on public.caregiver_availability to authenticated;

-- ---------------------------------------------------------------------------
-- Profile save: profile, contact and the gmina/service/availability lists in one transaction.
-- SECURITY INVOKER: every write goes through the caller's RLS (a coordinator is
-- stopped by the caregiver_profiles insert policy). Validation errors use
-- errcode 22023 with Polish messages meant to be shown to the user.
-- Duplicate and null entries in p_gminas/p_services/p_availability are ignored.
-- p_availability defaults to '{}', so a call without it (the previous signature) clears the availability.
-- ---------------------------------------------------------------------------
drop function public.save_caregiver_profile(text, text, text, text, text[], text[]);

create function public.save_caregiver_profile(
  p_display_name text,
  p_description text,
  p_phone text,
  p_email text,
  p_gminas text[],
  p_services text[],
  p_availability text[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_gminas text[];
  v_services text[];
  v_availability text[];
  v_invalid text;
begin
  if v_user_id is null then
    raise exception 'Musisz być zalogowany, aby zapisać profil.'
      using errcode = '28000';
  end if;

  v_gminas := array(
    select distinct x.code
    from unnest(coalesce(p_gminas, '{}'::text[])) as x(code)
    where x.code is not null
    order by x.code
  );
  v_services := array(
    select distinct x.slug
    from unnest(coalesce(p_services, '{}'::text[])) as x(slug)
    where x.slug is not null
    order by x.slug
  );
  v_availability := array(
    select distinct x.slot
    from unnest(coalesce(p_availability, '{}'::text[])) as x(slot)
    where x.slot is not null
    order by x.slot
  );

  if cardinality(v_gminas) > 30 then
    raise exception 'Możesz wybrać najwyżej 30 gmin.'
      using errcode = '22023';
  end if;

  select string_agg(x.code, ', ' order by x.code)
  into v_invalid
  from unnest(v_gminas) as x(code)
  where not exists (
    select 1
    from public.gminas as g
    where g.teryt = x.code
      and g.active
  );

  if v_invalid is not null then
    raise exception 'Nie można wybrać tych gmin (nie istnieją lub zostały wycofane): %. Wybierz je ponownie z listy.', v_invalid
      using errcode = '22023';
  end if;

  select string_agg(x.slug, ', ' order by x.slug)
  into v_invalid
  from unnest(v_services) as x(slug)
  where not exists (
    select 1
    from public.services as s
    where s.slug = x.slug
  );

  if v_invalid is not null then
    raise exception 'Nieznane usługi: %. Wybierz usługi z listy.', v_invalid
      using errcode = '22023';
  end if;

  -- Same pattern as the caregiver_availability.slot CHECK, reported earlier with a friendly message.
  select string_agg(x.slot, ', ' order by x.slot)
  into v_invalid
  from unnest(v_availability) as x(slot)
  where x.slot !~ '^(pon|wt|sr|czw|pt|sob|nd)-(rano|popoludnie|wieczor|noc)$';

  if v_invalid is not null then
    raise exception 'Nieznane terminy dostępności: %. Wybierz terminy z siatki.', v_invalid
      using errcode = '22023';
  end if;

  insert into public.caregiver_profiles (user_id, display_name, description)
  values (v_user_id, p_display_name, p_description)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        description = excluded.description,
        updated_at = now();

  insert into public.caregiver_contacts (caregiver_id, phone, email)
  values (v_user_id, p_phone, p_email)
  on conflict (caregiver_id) do update
    set phone = excluded.phone,
        email = excluded.email,
        updated_at = now();

  delete from public.caregiver_gminas as cg
  where cg.caregiver_id = v_user_id
    and cg.teryt <> all (v_gminas);

  insert into public.caregiver_gminas (caregiver_id, teryt)
  select v_user_id, x.code
  from unnest(v_gminas) as x(code)
  on conflict do nothing;

  delete from public.caregiver_services as cs
  where cs.caregiver_id = v_user_id
    and cs.service_slug <> all (v_services);

  insert into public.caregiver_services (caregiver_id, service_slug)
  select v_user_id, x.slug
  from unnest(v_services) as x(slug)
  on conflict do nothing;

  delete from public.caregiver_availability as ca
  where ca.caregiver_id = v_user_id
    and ca.slot <> all (v_availability);

  insert into public.caregiver_availability (caregiver_id, slot)
  select v_user_id, x.slot
  from unnest(v_availability) as x(slot)
  on conflict do nothing;
end;
$$;

comment on function public.save_caregiver_profile(text, text, text, text, text[], text[], text[]) is
  'Saves the caller''s caregiver profile, contact and gmina/service/availability lists atomically under the caller''s RLS. p_availability defaults to empty (clears the availability). Validation errors: errcode 22023 with a Polish message.';

-- ---------------------------------------------------------------------------
-- Caregiver search.
-- Matches are computed first (CTE), then counted with a window function and only then ordered,
-- offset and limited, so total_count is the number of all matches, not of the returned page.
-- p_teryt: null = any gmina; otherwise the caregiver must serve that gmina and it must be active.
-- p_services: null or empty = no service filter; otherwise the caregiver must offer every listed
-- slug (null entries are ignored). An unknown slug matches nobody; the app drops unknown slugs
-- before calling.
-- p_availability: no non-null entries (null, '{}', '{null}') = no availability filter; otherwise the
-- caregiver must have at least one of the listed slots (OR). An unknown slot matches nobody.
-- availability: the caregiver's slots ordered by slot text ('{}' when none); the app sets the canonical order.
-- Order: most recently updated profile first, user_id as a deterministic tie-breaker.
-- p_limit is clamped to 1..50, p_offset to >= 0. With no matching rows no row is returned, so no
-- total_count either (the service treats that as 0 only at offset 0).
-- ---------------------------------------------------------------------------
drop function public.search_caregivers(text, text[], int, int);

create function public.search_caregivers(
  p_teryt text default null,
  p_services text[] default null,
  p_availability text[] default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  user_id uuid,
  display_name text,
  description text,
  updated_at timestamptz,
  services jsonb,
  gminas jsonb,
  availability text[],
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matches as (
    select p.user_id, p.display_name, p.description, p.updated_at
    from public.caregiver_profiles as p
    where cardinality(public.caregiver_profile_missing(p.user_id)) = 0
      and (
        p_teryt is null
        or exists (
          select 1
          from public.caregiver_gminas as cg
          join public.gminas as g on g.teryt = cg.teryt
          where cg.caregiver_id = p.user_id
            and cg.teryt = p_teryt
            and g.active
        )
      )
      and not exists (
        select 1
        from unnest(coalesce(p_services, '{}'::text[])) as wanted(slug)
        where wanted.slug is not null
          and not exists (
            select 1
            from public.caregiver_services as cs
            where cs.caregiver_id = p.user_id
              and cs.service_slug = wanted.slug
          )
      )
      and (
        not exists (
          select 1
          from unnest(coalesce(p_availability, '{}'::text[])) as wanted(slot)
          where wanted.slot is not null
        )
        or exists (
          select 1
          from public.caregiver_availability as ca
          where ca.caregiver_id = p.user_id
            and ca.slot = any (p_availability)
        )
      )
  ),
  counted as (
    select m.user_id, m.display_name, m.description, m.updated_at, count(*) over () as total_count
    from matches as m
  ),
  paged as (
    select c.user_id, c.display_name, c.description, c.updated_at, c.total_count
    from counted as c
    order by c.updated_at desc, c.user_id
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select
    pg.user_id,
    pg.display_name,
    pg.description,
    pg.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('slug', s.slug, 'label', s.label) order by s.sort_order)
      from public.caregiver_services as cs
      join public.services as s on s.slug = cs.service_slug
      where cs.caregiver_id = pg.user_id
    ), '[]'::jsonb) as services,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teryt', g.teryt,
          'name', g.name,
          'kind', g.kind,
          'powiat', g.powiat,
          'wojewodztwo', g.wojewodztwo
        )
        order by g.name, g.teryt
      )
      from public.caregiver_gminas as cg
      join public.gminas as g on g.teryt = cg.teryt
      where cg.caregiver_id = pg.user_id
        and g.active
    ), '[]'::jsonb) as gminas,
    coalesce((
      select array_agg(ca.slot order by ca.slot)
      from public.caregiver_availability as ca
      where ca.caregiver_id = pg.user_id
    ), '{}'::text[]) as availability,
    pg.total_count
  from paged as pg
  order by pg.updated_at desc, pg.user_id;
$$;

comment on function public.search_caregivers(text, text[], text[], int, int) is
  'Public caregiver list: complete profiles only (caregiver_profile_missing() is empty), optionally in one active gmina, offering all given service slugs and having at least one of the given availability slots; newest updates first, paged (limit clamped to 1..50), total_count = all matches. availability = the caregiver''s slots (empty when none). Returns public columns only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Single public caregiver profile (for the profile page).
-- Zero rows when the profile does not exist or is incomplete (caregiver_profile_missing() is not
-- empty), exactly like search_caregivers(). services, gminas and availability have the shape and order
-- of search_caregivers() (gminas: active ones only). SECURITY INVOKER: reads the public tables under
-- the caller's RLS and never touches caregiver_contacts.
-- ---------------------------------------------------------------------------
drop function public.get_public_caregiver(uuid);

create function public.get_public_caregiver(p_caregiver_id uuid)
returns table (
  user_id uuid,
  display_name text,
  description text,
  services jsonb,
  gminas jsonb,
  availability text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.user_id,
    p.display_name,
    p.description,
    coalesce((
      select jsonb_agg(jsonb_build_object('slug', s.slug, 'label', s.label) order by s.sort_order)
      from public.caregiver_services as cs
      join public.services as s on s.slug = cs.service_slug
      where cs.caregiver_id = p.user_id
    ), '[]'::jsonb) as services,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teryt', g.teryt,
          'name', g.name,
          'kind', g.kind,
          'powiat', g.powiat,
          'wojewodztwo', g.wojewodztwo
        )
        order by g.name, g.teryt
      )
      from public.caregiver_gminas as cg
      join public.gminas as g on g.teryt = cg.teryt
      where cg.caregiver_id = p.user_id
        and g.active
    ), '[]'::jsonb) as gminas,
    coalesce((
      select array_agg(ca.slot order by ca.slot)
      from public.caregiver_availability as ca
      where ca.caregiver_id = p.user_id
    ), '{}'::text[]) as availability
  from public.caregiver_profiles as p
  where p.user_id = p_caregiver_id
    and cardinality(public.caregiver_profile_missing(p.user_id)) = 0;
$$;

comment on function public.get_public_caregiver(uuid) is
  'One public caregiver profile: zero rows when the profile does not exist or is incomplete (caregiver_profile_missing() is not empty). services, gminas (active only) and availability have the shape and order of search_caregivers(). Returns public columns only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Privileges. Functions are executable by PUBLIC by default, so execute is revoked
-- explicitly before granting it to the intended roles.
-- ---------------------------------------------------------------------------
revoke execute on function public.save_caregiver_profile(text, text, text, text, text[], text[], text[]) from public, anon;
grant execute on function public.save_caregiver_profile(text, text, text, text, text[], text[], text[]) to authenticated;

revoke execute on function public.search_caregivers(text, text[], text[], int, int) from public;
grant execute on function public.search_caregivers(text, text[], text[], int, int) to anon, authenticated;

revoke execute on function public.get_public_caregiver(uuid) from public;
grant execute on function public.get_public_caregiver(uuid) to anon, authenticated;
