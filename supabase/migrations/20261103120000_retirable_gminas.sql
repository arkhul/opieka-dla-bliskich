-- Migration: retirable_gminas
-- Purpose: let gminas be retired instead of deleted, so TERC updates never break references:
--   * public.gminas.active      - false once a gmina disappears from TERC (existing rows stay active)
--   * public.gminas.replaced_by - TERC code of the successor of a retired gmina (null if none)
--   * public.search_gminas()    - returns active gminas only
--   * public.normalize_pl()     - comment warns that changing it requires recomputing search_name
-- No new RLS policies or grants: the new columns are covered by the existing select policies
-- and grants for anon/authenticated, and create or replace keeps execute on search_gminas().

-- ---------------------------------------------------------------------------
-- Retirement state on gminas.
-- A retired gmina keeps its row (other tables may reference its teryt);
-- replaced_by points at the gmina that took over its area, e.g. after a RODZ change.
-- The foreign key uses the default (no action), so a successor cannot be deleted.
-- ---------------------------------------------------------------------------
alter table public.gminas
  add column active boolean not null default true,
  add column replaced_by text null references public.gminas (teryt),
  add constraint gminas_active_has_no_successor check (not active or replaced_by is null),
  add constraint gminas_replaced_by_not_self check (replaced_by <> teryt);

comment on table public.gminas is
  'Polish gminas from TERYT (TERC). Read-only via API; loaded and updated only by migrations. Rows are never deleted: gminas missing from TERC are retired (active = false).';
comment on column public.gminas.active is
  'False once the gmina is missing from TERC (retired). Retired gminas are hidden from search_gminas().';
comment on column public.gminas.replaced_by is
  'TERC code of the successor of a retired gmina (e.g. after a RODZ change); null for active gminas and for retired gminas without a successor.';

-- ---------------------------------------------------------------------------
-- Gmina search: same as in create_dictionaries, restricted to active gminas.
-- strpos() is used instead of LIKE so '%' and '_' in q are matched literally.
-- Order: names starting with the query first, then name, powiat (teryt as a
-- deterministic tie-breaker). max_results is clamped to 1..50.
-- SECURITY INVOKER: runs under the caller's role, so RLS on gminas applies.
-- ---------------------------------------------------------------------------
create or replace function public.search_gminas(q text, max_results int default 20)
returns setof public.gminas
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select public.normalize_pl(btrim(q)) as value
  )
  select g.*
  from public.gminas as g
  cross join needle
  where strpos(g.search_name, needle.value) > 0
    and g.active
  order by
    (strpos(g.search_name, needle.value) = 1) desc,
    g.name,
    g.powiat,
    g.teryt
  limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

comment on function public.search_gminas(text, int) is
  'Diacritic-insensitive search over active gminas; prefix matches first, then name, powiat. Limit clamped to 1..50.';

-- ---------------------------------------------------------------------------
-- normalize_pl(): gminas.search_name is a stored generated column, so it is
-- not recomputed when the function changes.
-- ---------------------------------------------------------------------------
comment on function public.normalize_pl(text) is
  'Lowercases text and strips Polish diacritics. Immutable; used by gminas.search_name and search_gminas(). WARNING: after changing this function run "update public.gminas set name = name" - search_name is a stored generated column and is not recomputed automatically.';
