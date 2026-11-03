-- Migration: coordinator_contact_access
-- Purpose: contact reveal after sign-in (slice S-03):
--   * caregiver_contacts_select_authenticated is replaced: the owner OR a coordinator may read a
--     contact row, and a coordinator only when the profile is complete
--   * public.get_public_caregiver() - one public caregiver profile for the profile page, with the
--     same visibility rule as the list
-- Decisions (S-03):
--   * Only accounts with the coordinator role see contact data of other people. Caregivers and
--     accounts without a role see only their own row. The role is trusted: public.accounts has no
--     write policies and is set only by handle_new_user() at sign-up.
--   * Only complete profiles are revealed (public.caregiver_profile_missing() is empty), so the
--     rule is the same single source as the public list. An incomplete profile stays private to its
--     owner, even for coordinators querying Supabase REST directly.
--   * There is no reveal log (contact_reveals), no rate limit and no scraping detection: one
--     coordinator sign-up opens every phone number (accepted in the PRD, Socratic notes to FR-012).
-- Accepted risk: a coordinator can fetch the contacts of ALL complete profiles with one
-- unfiltered GET /rest/v1/caregiver_contacts. A single-id RPC would not help, since it could be
-- called in a loop over the search_caregivers() results. Limits and scraping detection belong to a
-- later slice.
-- Anon still has no policy (and no table grant) on caregiver_contacts; insert/update policies and
-- table grants are unchanged. caregiver_profile_missing() is SECURITY DEFINER, so calling it from
-- the policy does not recurse into RLS of caregiver_contacts.
-- save_caregiver_profile() upserts into caregiver_contacts: the owner still passes the select
-- policy through the first branch, so the upsert keeps working.

-- ---------------------------------------------------------------------------
-- Contact read policy: one select policy for authenticated (owner or coordinator + complete profile).
-- ---------------------------------------------------------------------------
drop policy caregiver_contacts_select_authenticated on public.caregiver_contacts;

create policy caregiver_contacts_select_authenticated on public.caregiver_contacts
  for select to authenticated
  using (
    caregiver_id = (select auth.uid())
    or (
      exists (
        select 1
        from public.accounts as a
        where a.user_id = (select auth.uid())
          and a.role = 'coordinator'
      )
      and cardinality(public.caregiver_profile_missing(caregiver_id)) = 0
    )
  );

comment on table public.caregiver_contacts is
  'Contact data of a caregiver. Readable by the profile owner and by coordinator accounts when the profile is complete; writable only by the owner; never exposed to anon.';

-- ---------------------------------------------------------------------------
-- Single public caregiver profile (for the profile page).
-- Zero rows when the profile does not exist or is incomplete (caregiver_profile_missing() is not
-- empty), exactly like search_caregivers(). services and gminas have the shape and order of
-- search_caregivers() (gminas: active ones only). SECURITY INVOKER: reads the public tables under
-- the caller's RLS and never touches caregiver_contacts.
-- ---------------------------------------------------------------------------
create function public.get_public_caregiver(p_caregiver_id uuid)
returns table (
  user_id uuid,
  display_name text,
  description text,
  services jsonb,
  gminas jsonb
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
    ), '[]'::jsonb) as gminas
  from public.caregiver_profiles as p
  where p.user_id = p_caregiver_id
    and cardinality(public.caregiver_profile_missing(p.user_id)) = 0;
$$;

comment on function public.get_public_caregiver(uuid) is
  'One public caregiver profile: zero rows when the profile does not exist or is incomplete (caregiver_profile_missing() is not empty). services and gminas (active only) have the shape and order of search_caregivers(). Returns public columns only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Privileges. Functions are executable by PUBLIC by default, so execute is revoked
-- explicitly before granting it to the intended roles.
-- ---------------------------------------------------------------------------
revoke execute on function public.get_public_caregiver(uuid) from public;
grant execute on function public.get_public_caregiver(uuid) to anon, authenticated;
