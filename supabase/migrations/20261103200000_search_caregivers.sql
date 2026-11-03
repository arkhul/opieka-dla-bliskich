-- Migration: search_caregivers
-- Purpose: single source of the public caregiver list (slice S-02):
--   * public.search_caregivers() - complete profiles only, optional active-gmina filter, optional
--     "has all selected services" filter, newest updates first, paging and the total match count
-- Visibility rule (decision F7 from the caregiver-profile-setup review): the list reuses
-- public.caregiver_profile_missing() instead of duplicating the completeness rule, and the existing
-- execute grant for anon on that function stays, because the list itself reveals which profiles are
-- complete, so the function exposes nothing beyond the list.
-- No new tables, policies or data changes. The function is SECURITY INVOKER: it reads the public
-- tables under the caller's RLS and never touches caregiver_contacts (only the definer-rights
-- completeness function does, and it returns names of missing items, not contact data).

-- ---------------------------------------------------------------------------
-- Caregiver search.
-- Matches are computed first (CTE), then counted with a window function and only then ordered,
-- offset and limited, so total_count is the number of all matches, not of the returned page.
-- p_teryt: null = any gmina; otherwise the caregiver must serve that gmina and it must be active.
-- p_services: null or empty = no service filter; otherwise the caregiver must offer every listed
-- slug (null entries are ignored). An unknown slug matches nobody; the app drops unknown slugs
-- before calling.
-- Order: most recently updated profile first, user_id as a deterministic tie-breaker.
-- p_limit is clamped to 1..50, p_offset to >= 0. With no matching rows no row is returned, so no
-- total_count either (the service treats that as 0 only at offset 0).
-- ---------------------------------------------------------------------------
create function public.search_caregivers(
  p_teryt text default null,
  p_services text[] default null,
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
    pg.total_count
  from paged as pg
  order by pg.updated_at desc, pg.user_id;
$$;

comment on function public.search_caregivers(text, text[], int, int) is
  'Public caregiver list: complete profiles only (caregiver_profile_missing() is empty), optionally in one active gmina and offering all given service slugs; newest updates first, paged (limit clamped to 1..50), total_count = all matches. Returns public columns only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Privileges. Functions are executable by PUBLIC by default, so execute is revoked
-- explicitly before granting it to the intended roles.
-- ---------------------------------------------------------------------------
revoke execute on function public.search_caregivers(text, text[], int, int) from public;
grant execute on function public.search_caregivers(text, text[], int, int) to anon, authenticated;
