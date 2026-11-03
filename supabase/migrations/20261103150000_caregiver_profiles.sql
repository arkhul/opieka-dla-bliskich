-- Migration: caregiver_profiles
-- Purpose: account roles and caregiver profiles, with contact data separated at the database level:
--   * public.accounts           - role chosen at sign-up (copied by a trigger on auth.users), read-only for its owner
--   * public.caregiver_profiles - public part of a caregiver profile (readable by anon)
--   * public.caregiver_contacts - phone and e-mail, readable and writable only by the profile owner
--   * public.caregiver_gminas   - gminas served by a caregiver (readable by anon)
--   * public.caregiver_services - services offered by a caregiver (readable by anon)
--   * public.save_caregiver_profile()    - atomic save of the caller's whole profile, under the caller's RLS
--   * public.caregiver_profile_missing() - single source of the profile completeness rule
-- Supabase grants all table privileges in public to anon/authenticated by default, so RLS is the
-- only gate: every table below has RLS turned on here, with one policy per operation and role.
-- Profiles are keyed by auth.users.id, so ownership checks are "= (select auth.uid())".

-- ---------------------------------------------------------------------------
-- Account roles
-- The role is set only by handle_new_user() at sign-up. There are no insert/update/delete
-- policies, so a user can never change their role through the API; policies on other
-- tables can therefore trust it.
-- ---------------------------------------------------------------------------
create table public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('caregiver', 'coordinator')),
  created_at timestamptz not null default now()
);

comment on table public.accounts is
  'Account role chosen at sign-up, copied from auth.users.raw_user_meta_data by handle_new_user(). Each user can read only their own row; nobody can write it via the API.';
comment on column public.accounts.role is
  'caregiver (offers care) or coordinator (looks for care). Immutable via the API.';

alter table public.accounts enable row level security;

create policy accounts_select_authenticated on public.accounts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Caregiver profiles (public part)
-- Only users with the caregiver role can create a profile. No delete policy (profile
-- removal is a later slice); rows go away with the auth user (cascade).
-- ---------------------------------------------------------------------------
create table public.caregiver_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name = btrim(display_name) and char_length(btrim(display_name)) between 2 and 60),
  description text null check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.caregiver_profiles is
  'Public part of a caregiver profile, readable by anon. Contact data lives in caregiver_contacts.';
comment on column public.caregiver_profiles.user_id is
  'auth.users.id of the caregiver who owns the profile.';
comment on column public.caregiver_profiles.display_name is
  'Name shown publicly; 2-60 characters, no leading or trailing whitespace.';
comment on column public.caregiver_profiles.description is
  'Optional free-text description, at most 1000 characters.';
comment on column public.caregiver_profiles.updated_at is
  'Set to now() by save_caregiver_profile() on every save.';

alter table public.caregiver_profiles enable row level security;

create policy caregiver_profiles_select_anon on public.caregiver_profiles
  for select to anon
  using (true);

create policy caregiver_profiles_select_authenticated on public.caregiver_profiles
  for select to authenticated
  using (true);

create policy caregiver_profiles_insert_authenticated on public.caregiver_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.accounts as a
      where a.user_id = (select auth.uid())
        and a.role = 'caregiver'
    )
  );

create policy caregiver_profiles_update_authenticated on public.caregiver_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Caregiver contacts (private part)
-- Never readable by anon; authenticated users see only their own row.
-- ---------------------------------------------------------------------------
create table public.caregiver_contacts (
  caregiver_id uuid primary key references public.caregiver_profiles (user_id) on delete cascade,
  phone text null check (phone ~ '^\+48[0-9]{9}$'),
  email text null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

comment on table public.caregiver_contacts is
  'Contact data of a caregiver. Readable and writable only by the profile owner; never exposed to anon.';
comment on column public.caregiver_contacts.phone is
  'Polish phone number normalized to +48XXXXXXXXX; null if not provided.';
comment on column public.caregiver_contacts.email is
  'Contact e-mail (may differ from the login e-mail), at most 254 characters; null if not provided.';

alter table public.caregiver_contacts enable row level security;

create policy caregiver_contacts_select_authenticated on public.caregiver_contacts
  for select to authenticated
  using (caregiver_id = (select auth.uid()));

create policy caregiver_contacts_insert_authenticated on public.caregiver_contacts
  for insert to authenticated
  with check (caregiver_id = (select auth.uid()));

create policy caregiver_contacts_update_authenticated on public.caregiver_contacts
  for update to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Gminas served by a caregiver
-- teryt uses on delete restrict: gminas are retired, never deleted, and the gminas
-- generator re-points links from retired gminas to their active successors.
-- Only active gminas can be added (save_caregiver_profile() reports this earlier
-- with a friendly message; the policy is defence in depth).
-- ---------------------------------------------------------------------------
create table public.caregiver_gminas (
  caregiver_id uuid not null references public.caregiver_profiles (user_id) on delete cascade,
  teryt text not null references public.gminas (teryt) on delete restrict,
  primary key (caregiver_id, teryt)
);

create index caregiver_gminas_teryt_idx on public.caregiver_gminas (teryt);

comment on table public.caregiver_gminas is
  'Gminas served by a caregiver. Public. New links only to active gminas; links to retired gminas are re-pointed by the gminas generator.';

alter table public.caregiver_gminas enable row level security;

create policy caregiver_gminas_select_anon on public.caregiver_gminas
  for select to anon
  using (true);

create policy caregiver_gminas_select_authenticated on public.caregiver_gminas
  for select to authenticated
  using (true);

create policy caregiver_gminas_insert_authenticated on public.caregiver_gminas
  for insert to authenticated
  with check (
    caregiver_id = (select auth.uid())
    and exists (
      select 1
      from public.gminas as g
      where g.teryt = caregiver_gminas.teryt
        and g.active
    )
  );

create policy caregiver_gminas_delete_authenticated on public.caregiver_gminas
  for delete to authenticated
  using (caregiver_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Services offered by a caregiver
-- ---------------------------------------------------------------------------
create table public.caregiver_services (
  caregiver_id uuid not null references public.caregiver_profiles (user_id) on delete cascade,
  service_slug text not null references public.services (slug) on delete restrict,
  primary key (caregiver_id, service_slug)
);

create index caregiver_services_service_slug_idx on public.caregiver_services (service_slug);

comment on table public.caregiver_services is
  'Services offered by a caregiver, from the closed services catalogue. Public.';

alter table public.caregiver_services enable row level security;

create policy caregiver_services_select_anon on public.caregiver_services
  for select to anon
  using (true);

create policy caregiver_services_select_authenticated on public.caregiver_services
  for select to authenticated
  using (true);

create policy caregiver_services_insert_authenticated on public.caregiver_services
  for insert to authenticated
  with check (caregiver_id = (select auth.uid()));

create policy caregiver_services_delete_authenticated on public.caregiver_services
  for delete to authenticated
  using (caregiver_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Role from sign-up: copies raw_user_meta_data->>'role' into public.accounts.
-- Fail-closed: a missing or unknown role aborts the sign-up. Any error here blocks
-- every sign-up ("Database error saving new user"), hence SECURITY DEFINER,
-- an empty search_path and fully qualified names.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_user_meta_data ->> 'role';
begin
  if v_role is null or v_role not in ('caregiver', 'coordinator') then
    raise exception 'Invalid or missing account role: %', coalesce(v_role, '(none)')
      using errcode = '22023',
            hint = 'Pass options.data.role = ''caregiver'' or ''coordinator'' to signUp().';
  end if;

  insert into public.accounts (user_id, role)
  values (new.id, v_role);

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger on auth.users: copies the sign-up role into public.accounts; rejects sign-ups without a valid role.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Profile save: profile, contact and the gmina/service lists in one transaction.
-- SECURITY INVOKER: every write goes through the caller's RLS (a coordinator is
-- stopped by the caregiver_profiles insert policy). Validation errors use
-- errcode 22023 with Polish messages meant to be shown to the user.
-- Duplicate and null entries in p_gminas/p_services are ignored.
-- ---------------------------------------------------------------------------
create function public.save_caregiver_profile(
  p_display_name text,
  p_description text,
  p_phone text,
  p_email text,
  p_gminas text[],
  p_services text[]
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
end;
$$;

comment on function public.save_caregiver_profile(text, text, text, text, text[], text[]) is
  'Saves the caller''s caregiver profile, contact and gmina/service lists atomically under the caller''s RLS. Validation errors: errcode 22023 with a Polish message.';

-- ---------------------------------------------------------------------------
-- Completeness rule: complete = display name + phone + at least one active gmina
-- + at least one service. Returns what is missing, in the fixed order
-- {display_name, phone, gminas, services}; an empty array means complete.
-- SECURITY DEFINER so anon can evaluate it (it reads caregiver_contacts), but it
-- reveals only whether a phone exists, never the contact data itself.
-- ---------------------------------------------------------------------------
create function public.caregiver_profile_missing(p_caregiver_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when not exists (
      select 1
      from public.caregiver_profiles as p
      where p.user_id = p_caregiver_id
    ) then 'display_name' end,
    case when not exists (
      select 1
      from public.caregiver_contacts as c
      where c.caregiver_id = p_caregiver_id
        and c.phone is not null
    ) then 'phone' end,
    case when not exists (
      select 1
      from public.caregiver_gminas as cg
      join public.gminas as g on g.teryt = cg.teryt
      where cg.caregiver_id = p_caregiver_id
        and g.active
    ) then 'gminas' end,
    case when not exists (
      select 1
      from public.caregiver_services as cs
      where cs.caregiver_id = p_caregiver_id
    ) then 'services' end
  ]::text[], null);
$$;

comment on function public.caregiver_profile_missing(uuid) is
  'Missing items of a caregiver profile, subset of {display_name, phone, gminas, services} in that order; empty = complete. Counts only active gminas. Never returns contact data.';

-- ---------------------------------------------------------------------------
-- Privileges. Table grants mirror the policies (Supabase already grants all by
-- default, RLS is the gate). Functions are executable by PUBLIC by default, so
-- execute is revoked explicitly before granting it to the intended roles.
-- ---------------------------------------------------------------------------
grant select on public.accounts to authenticated;
grant select on public.caregiver_profiles to anon;
grant select, insert, update on public.caregiver_profiles to authenticated;
grant select, insert, update on public.caregiver_contacts to authenticated;
grant select on public.caregiver_gminas to anon;
grant select, insert, delete on public.caregiver_gminas to authenticated;
grant select on public.caregiver_services to anon;
grant select, insert, delete on public.caregiver_services to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.save_caregiver_profile(text, text, text, text, text[], text[]) from public, anon;
grant execute on function public.save_caregiver_profile(text, text, text, text, text[], text[]) to authenticated;

revoke execute on function public.caregiver_profile_missing(uuid) from public;
grant execute on function public.caregiver_profile_missing(uuid) to anon, authenticated;
