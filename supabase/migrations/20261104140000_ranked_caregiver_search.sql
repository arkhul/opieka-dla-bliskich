-- Migration: ranked_caregiver_search
-- Purpose: the public caregiver list is ordered by how well a profile matches the selected needs, and every row
-- says what is missing (slice S-05, US-01, FR-016):
--   * public.search_caregivers()         - gmina stays a hard filter, services need at least one match, services
--                                          and slots set the order; new columns matched_services,
--                                          missing_services, matched_slots, missing_slots
--   * public.count_caregivers_relaxed()  - the empty-result hint counts (without services, without gmina) in one
--                                          call (follow-up F6 from S-04)
-- Decisions (S-05):
--   * Threshold: when services are selected, a profile must offer at least one of them; a profile offering none
--     of the selected services is not listed. Profiles offering more of them rank higher.
--   * Slots are fully soft: they never hide a profile (also not one without any availability), they only set the
--     order within the same service coverage.
--   * Lexicographic ranking: matched_services desc, then matched_slots desc, so no number of slots outranks a
--     service (PRD: service coverage weighs most). No weights, no score sum.
--   * Tie-breaker unchanged: updated_at desc, user_id. Without selected services and slots the list keeps the
--     order it had before this migration.
--   * Coverage is counted for every candidate before count(*) over (), order by and limit/offset, so the ranking
--     covers the whole result, not one page. The missing lists (jsonb/text[]) are built for the returned page
--     only (at most 50 rows), like services and gminas.
--   * Deployment order: this migration first (supabase db push), then the Worker (wrangler deploy). The
--     parameters and their defaults are unchanged and PostgREST calls functions by parameter name, so the old
--     Worker keeps working in the window between the two steps: it reads only the old columns and ignores the
--     new ones. The new Worker needs the new columns and count_caregivers_relaxed(), so it must not go first.
-- Changing the result columns needs drop + create (create or replace cannot change "returns table"), so
-- search_caregivers() is dropped, recreated and granted again. count_caregivers_relaxed() is the only other
-- object that depends on it, and it is created here. No data changes and no table changes: the table privilege
-- matrix from 20261104120000_caregiver_availability.sql (24 rows) stays as it is.

-- ---------------------------------------------------------------------------
-- Caregiver search, ranked by match.
-- Selected services = the distinct non-null entries of p_services; selected slots = the distinct non-null
-- entries of p_availability. null, '{}' and '{null}' mean nothing is selected.
-- Result set: complete profiles only (caregiver_profile_missing() is empty); p_teryt null = any gmina, otherwise
-- the caregiver must serve that gmina and it must be active; when services are selected, the caregiver must
-- offer at least one of them. Slots never narrow the result. An unknown slug or slot matches nobody; the app
-- drops unknown values before calling.
-- matched_services / matched_slots: how many of the selected services / slots the profile has (0 when nothing
-- is selected). They are computed per candidate (CTE), then all candidates are counted with a window function,
-- and only then ordered, offset and limited, so total_count is the number of all matches, not of the page.
-- missing_services: the selected services the profile does not offer, joined with the services dictionary
-- (unknown slugs skipped), as [{slug, label}] in sort_order ('[]' when none).
-- missing_slots: the selected slots the profile does not have, ordered by slot text ('{}' when none); the app
-- sets the canonical order, as for availability.
-- availability: the caregiver's slots ordered by slot text ('{}' when none).
-- Order: matched_services desc, matched_slots desc, then the most recently updated profile first, user_id as a
-- deterministic tie-breaker.
-- p_limit is clamped to 1..50, p_offset to >= 0. With no matching rows no row is returned, so no
-- total_count either (the service treats that as 0 only at offset 0).
-- ---------------------------------------------------------------------------
drop function public.search_caregivers(text, text[], text[], int, int);

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
  matched_services int,
  missing_services jsonb,
  matched_slots int,
  missing_slots text[],
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with wanted_services as (
    select distinct w.slug
    from unnest(coalesce(p_services, '{}'::text[])) as w(slug)
    where w.slug is not null
  ),
  wanted_slots as (
    select distinct w.slot
    from unnest(coalesce(p_availability, '{}'::text[])) as w(slot)
    where w.slot is not null
  ),
  candidates as (
    select
      p.user_id,
      p.display_name,
      p.description,
      p.updated_at,
      (
        select count(*)::int
        from public.caregiver_services as cs
        join wanted_services as ws on ws.slug = cs.service_slug
        where cs.caregiver_id = p.user_id
      ) as matched_services,
      (
        select count(*)::int
        from public.caregiver_availability as ca
        join wanted_slots as wa on wa.slot = ca.slot
        where ca.caregiver_id = p.user_id
      ) as matched_slots
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
  ),
  matches as (
    select c.user_id, c.display_name, c.description, c.updated_at, c.matched_services, c.matched_slots
    from candidates as c
    where c.matched_services >= 1
      or not exists (select 1 from wanted_services)
  ),
  counted as (
    select
      m.user_id,
      m.display_name,
      m.description,
      m.updated_at,
      m.matched_services,
      m.matched_slots,
      count(*) over () as total_count
    from matches as m
  ),
  paged as (
    select
      c.user_id,
      c.display_name,
      c.description,
      c.updated_at,
      c.matched_services,
      c.matched_slots,
      c.total_count
    from counted as c
    order by c.matched_services desc, c.matched_slots desc, c.updated_at desc, c.user_id
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
    pg.matched_services,
    coalesce((
      select jsonb_agg(jsonb_build_object('slug', s.slug, 'label', s.label) order by s.sort_order)
      from wanted_services as ws
      join public.services as s on s.slug = ws.slug
      where not exists (
        select 1
        from public.caregiver_services as cs
        where cs.caregiver_id = pg.user_id
          and cs.service_slug = ws.slug
      )
    ), '[]'::jsonb) as missing_services,
    pg.matched_slots,
    coalesce((
      select array_agg(wa.slot order by wa.slot)
      from wanted_slots as wa
      where not exists (
        select 1
        from public.caregiver_availability as ca
        where ca.caregiver_id = pg.user_id
          and ca.slot = wa.slot
      )
    ), '{}'::text[]) as missing_slots,
    pg.total_count
  from paged as pg
  order by pg.matched_services desc, pg.matched_slots desc, pg.updated_at desc, pg.user_id;
$$;

comment on function public.search_caregivers(text, text[], text[], int, int) is
  'Public caregiver list ranked by match: complete profiles only (caregiver_profile_missing() is empty), optionally in one active gmina (hard filter); with selected services only profiles offering at least one of them; slots never hide a profile. Order: matched_services desc, matched_slots desc, updated_at desc, user_id; paged (limit clamped to 1..50), total_count = all matches. missing_services ([{slug, label}] in sort_order) and missing_slots (by slot text) = the selected services/slots the profile lacks. availability = the caregiver''s slots (empty when none). Returns public columns only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Empty-result hint counts in one call: how many profiles the list would show without the service filter and
-- without the gmina filter. Replaces up to three search_caregivers() calls per request (follow-up F6 from S-04).
-- Always exactly one row. The rule is not repeated here: both counts come from search_caregivers() with one
-- dimension removed (total_count of the first page, 0 when nothing matches).
-- without_services: null when no service is selected (no non-null entries in p_services: null, '{}', '{null}',
--   as in search_caregivers(); the app sends an empty array, not null).
-- without_gmina: null when p_teryt is null.
-- No slots parameter: slots never narrow the result, so removing them never changes a count.
-- SECURITY INVOKER, like search_caregivers(): public columns only, under the caller's RLS.
-- ---------------------------------------------------------------------------
create function public.count_caregivers_relaxed(
  p_teryt text default null,
  p_services text[] default null
)
returns table (
  without_services bigint,
  without_gmina bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case
      when exists (
        select 1
        from unnest(coalesce(p_services, '{}'::text[])) as w(slug)
        where w.slug is not null
      )
      then coalesce((
        select r.total_count
        from public.search_caregivers(p_teryt, null, null, 1, 0) as r
      ), 0)
    end as without_services,
    case
      when p_teryt is not null
      then coalesce((
        select r.total_count
        from public.search_caregivers(null, p_services, null, 1, 0) as r
      ), 0)
    end as without_gmina;
$$;

comment on function public.count_caregivers_relaxed(text, text[]) is
  'Empty-result hint counts in one row: without_services = matches of search_caregivers() without the service filter (null when no service is selected), without_gmina = matches without the gmina filter (null when p_teryt is null). Replaces up to three search_caregivers() calls per request. Counts only, never caregiver_contacts data.';

-- ---------------------------------------------------------------------------
-- Privileges. Functions are executable by PUBLIC by default, so execute is revoked
-- explicitly before granting it to the intended roles.
-- ---------------------------------------------------------------------------
revoke execute on function public.search_caregivers(text, text[], text[], int, int) from public;
grant execute on function public.search_caregivers(text, text[], text[], int, int) to anon, authenticated;

revoke execute on function public.count_caregivers_relaxed(text, text[]) from public;
grant execute on function public.count_caregivers_relaxed(text, text[]) to anon, authenticated;
