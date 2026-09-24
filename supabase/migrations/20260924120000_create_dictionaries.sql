-- Migration: create_dictionaries
-- Purpose: read-only reference dictionaries used by caregiver profiles and filters:
--   * public.services - closed catalogue of 13 service types (seeded here)
--   * public.gminas   - all Polish gminas from TERYT/TERC (data arrives in a later migration)
-- Both tables are publicly readable (anon + authenticated) and have no write policies,
-- so the API can never modify them; changes happen only through new migrations.
-- Reference data lives in migrations (not seed.sql) because production only runs migrations.

-- ---------------------------------------------------------------------------
-- Normalization: lowercase + strip Polish diacritics.
-- Must be IMMUTABLE because gminas.search_name is a stored generated column
-- (unaccent() is only STABLE, so it cannot be used there).
-- Shared by gminas.search_name and search_gminas() so both sides normalize identically.
-- ---------------------------------------------------------------------------
create function public.normalize_pl(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(translate(input, 'ĄĆĘŁŃÓŚŹŻąćęłńóśźż', 'ACELNOSZZacelnoszz'));
$$;

comment on function public.normalize_pl(text) is
  'Lowercases text and strips Polish diacritics. Immutable; used by gminas.search_name and search_gminas().';

-- ---------------------------------------------------------------------------
-- Services catalogue
-- ---------------------------------------------------------------------------
create table public.services (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null unique,
  sort_order smallint not null unique
);

comment on table public.services is
  'Closed catalogue of care service types. Read-only via API; changed only by migrations.';

alter table public.services enable row level security;

create policy services_select_anon on public.services
  for select to anon
  using (true);

create policy services_select_authenticated on public.services
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Gminas dictionary (TERYT/TERC)
-- teryt = 7-digit TERC code (WOJ+POW+GMI+RODZ); only RODZ 1/2/3 are stored.
-- Same-name gminas can exist within one powiat (e.g. Łowicz miejska and wiejska),
-- so kind is part of the data and of any user-facing label.
-- ---------------------------------------------------------------------------
create table public.gminas (
  teryt text primary key check (teryt ~ '^[0-9]{6}[123]$'),
  name text not null,
  kind text not null check (kind in ('miejska', 'wiejska', 'miejsko-wiejska')),
  powiat text not null,
  wojewodztwo text not null,
  search_name text generated always as (public.normalize_pl(name)) stored
);

comment on table public.gminas is
  'Polish gminas from TERYT (TERC). Read-only via API; loaded and updated only by migrations.';
comment on column public.gminas.search_name is
  'normalize_pl(name): lowercase, no Polish diacritics; used for search.';

alter table public.gminas enable row level security;

create policy gminas_select_anon on public.gminas
  for select to anon
  using (true);

create policy gminas_select_authenticated on public.gminas
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Gmina search: diacritic-insensitive substring match on search_name.
-- strpos() is used instead of LIKE so '%' and '_' in q are matched literally.
-- Order: names starting with the query first, then name, powiat (teryt as a
-- deterministic tie-breaker). max_results is clamped to 1..50.
-- SECURITY INVOKER: runs under the caller's role, so RLS on gminas applies.
-- ---------------------------------------------------------------------------
create function public.search_gminas(q text, max_results int default 20)
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
  order by
    (strpos(g.search_name, needle.value) = 1) desc,
    g.name,
    g.powiat,
    g.teryt
  limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

comment on function public.search_gminas(text, int) is
  'Diacritic-insensitive gmina search; prefix matches first, then name, powiat. Limit clamped to 1..50.';

-- ---------------------------------------------------------------------------
-- Privileges: read-only access for API roles. Writes are denied by RLS
-- (no insert/update/delete policies exist).
-- ---------------------------------------------------------------------------
grant select on public.services to anon, authenticated;
grant select on public.gminas to anon, authenticated;
grant execute on function public.normalize_pl(text) to anon, authenticated;
grant execute on function public.search_gminas(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Service catalogue data
-- ---------------------------------------------------------------------------
insert into public.services (slug, label, sort_order) values
  ('towarzystwo', 'Towarzystwo i rozmowa', 1),
  ('higiena-osobista', 'Pomoc w higienie osobistej', 2),
  ('ubieranie-i-przemieszczanie', 'Pomoc przy ubieraniu i przemieszczaniu się', 3),
  ('posilki-i-karmienie', 'Przygotowanie posiłków i karmienie', 4),
  ('pilnowanie-lekow', 'Pilnowanie przyjmowania leków', 5),
  ('zakupy-i-sprawy', 'Zakupy i załatwianie spraw', 6),
  ('prace-domowe', 'Sprzątanie i prace domowe', 7),
  ('wizyty-lekarskie', 'Towarzyszenie w wizytach lekarskich', 8),
  ('spacery-i-aktywizacja', 'Spacery i aktywizacja', 9),
  ('osoba-lezaca', 'Opieka nad osobą leżącą', 10),
  ('demencja', 'Opieka nad osobą z demencją', 11),
  ('czynnosci-pielegniarskie', 'Czynności pielęgniarskie (zastrzyki, opatrunki)', 12),
  ('cwiczenia-usprawniajace', 'Ćwiczenia usprawniające', 13);
