-- Migration: save_profile_keeps_availability
-- Purpose: public.save_caregiver_profile() no longer clears the availability when p_availability is omitted.
-- Why: 20261104120000_caregiver_availability.sql gave p_availability the default '{}', which was safe only in the
--   deploy window (nobody had availability yet). After that, any caller using the 6-parameter shape - e.g. a
--   Worker rolled back to a version from before S-04 - would silently delete every caregiver's availability on each
--   profile save.
-- Now: p_availability defaults to null, and null means "leave the availability unchanged". An explicit array
--   (including '{}') still replaces the rows. The current Worker always sends an explicit array (zod .default([])),
--   so its behaviour does not change.
-- Also: more than 28 distinct slots are rejected up front (input-size guard, like the 30-gmina limit).
-- The signature (argument types) is unchanged, so create or replace keeps the existing grants
-- (execute: authenticated only).

create or replace function public.save_caregiver_profile(
  p_display_name text,
  p_description text,
  p_phone text,
  p_email text,
  p_gminas text[],
  p_services text[],
  p_availability text[] default null
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
  -- null = keep the availability as it is; any array (also '{}') replaces it.
  if p_availability is not null then
    v_availability := array(
      select distinct x.slot
      from unnest(p_availability) as x(slot)
      where x.slot is not null
      order by x.slot
    );
  end if;

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

  if v_availability is not null then
    if cardinality(v_availability) > 28 then
      raise exception 'Lista terminów jest zbyt długa.'
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

  if v_availability is not null then
    delete from public.caregiver_availability as ca
    where ca.caregiver_id = v_user_id
      and ca.slot <> all (v_availability);

    insert into public.caregiver_availability (caregiver_id, slot)
    select v_user_id, x.slot
    from unnest(v_availability) as x(slot)
    on conflict do nothing;
  end if;
end;
$$;

comment on function public.save_caregiver_profile(text, text, text, text, text[], text[], text[]) is
  'Saves the caller''s caregiver profile, contact and gmina/service/availability lists atomically under the caller''s RLS. p_availability null (the default) keeps the availability unchanged; an array (also empty) replaces it. Validation errors: errcode 22023 with a Polish message.';
