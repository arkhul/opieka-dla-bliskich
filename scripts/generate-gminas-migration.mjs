// Generates a migration that syncs public.gminas with the official GUS TERYT TERC file (wersja urzędowa, CSV).
// Zero dependencies on purpose. One mode only (sync), so the same output works on an empty and on a populated table:
// it upserts every gmina from the file and retires (active = false, never deletes) active gminas missing from it;
// when only RODZ changed (same WOJ+POW+GMI), the new code is set as replaced_by automatically.
// Caregiver gminas (public.caregiver_gminas) linked to a retired gmina are re-pointed to its replaced_by when that
// successor is active; links to a retired gmina without an active successor are left as they are and listed in a notice.
//   node scripts/generate-gminas-migration.mjs <path-to-TERC.csv> supabase/migrations/<YYYYMMDDHHmmss>_update_gminas.sql [--max-retired N]
// --max-retired N: the migration aborts without changes if more than N gminas would be retired without a successor
// (default 30; RODZ changes do not count). Refuses a TERC file whose STAN_NA is older than in existing migrations.
// Download: eteryt.stat.gov.pl -> "Pobieranie plików" -> TERC, wersja urzędowa, CSV. Do not commit the raw CSV.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const KINDS = { 1: "miejska", 2: "wiejska", 3: "miejsko-wiejska" };
const REQUIRED_COLUMNS = ["WOJ", "POW", "GMI", "RODZ", "NAZWA", "NAZWA_DOD", "STAN_NA"];
const EXPECTED_WOJEWODZTWA = 16;
const MIN_GMINAS = 2470;
const MAX_GMINAS = 2490;
const BATCH_SIZE = 500;
const DEFAULT_MAX_RETIRED = 30;
const MAX_INT = 2147483647; // Postgres integer, used for the threshold in the generated SQL
const MIGRATION_FILE = /^\d{14}_([a-z0-9_]+)\.sql$/;
const STAN_NA_LINE = /^-- STAN_NA: (\d{4}-\d{2}-\d{2})$/;
const USAGE = "usage: node scripts/generate-gminas-migration.mjs <path-to-TERC.csv> <output.sql> [--max-retired N]";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// Semicolon-separated CSV; fields are normally unquoted, but double-quoted fields ("" = literal quote) are handled.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) fail("CSV ends inside a quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

// Names go into a "--" comment line; a control character (newline) would end the comment.
function commentSafe(value) {
  return [...value].map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? "?" : ch)).join("");
}

// Arguments are checked before the TERC file is read.
const positional = [];
let maxRetired = DEFAULT_MAX_RETIRED;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--max-retired") {
    const value = args[++i];
    if (value === undefined || !/^\d+$/.test(value) || Number(value) > MAX_INT) {
      fail(
        `--max-retired needs a whole number between 0 and ${MAX_INT}, got ${value === undefined ? "nothing" : `"${value}"`}\n${USAGE}`,
      );
    }
    maxRetired = Number(value);
  } else if (arg.startsWith("-")) fail(`unknown option ${arg}\n${USAGE}`);
  else positional.push(arg);
}
if (positional.length !== 2) fail(USAGE);
const [inputPath, outputPath] = positional;

const outputFile = path.basename(outputPath);
const migrationMatch = MIGRATION_FILE.exec(outputFile);
if (!migrationMatch) {
  fail(`output file name "${outputFile}" must look like <YYYYMMDDHHmmss>_<name>.sql (lowercase letters, digits, _)`);
}
const migrationName = migrationMatch[1];

let text;
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(inputPath));
} catch (error) {
  fail(`cannot read ${inputPath} (the file must exist and be UTF-8): ${error.message}`);
}
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

const [header, ...records] = parseCsv(text);
if (!header) fail("input file is empty");
const columns = header.map((name) => name.trim().toUpperCase());
const index = {};
for (const name of REQUIRED_COLUMNS) {
  index[name] = columns.indexOf(name);
  if (index[name] === -1) fail(`missing column ${name}; header is: ${header.join(";")}`);
}

const wojewodztwa = new Map(); // WOJ -> name
const powiaty = new Map(); // WOJ+POW -> name
const units = []; // gmina-level rows with RODZ 1/2/3
const stanNaValues = new Set();

records.forEach((fields, i) => {
  const line = i + 2;
  if (fields.length < columns.length) fail(`line ${line}: expected ${columns.length} fields, got ${fields.length}`);
  const get = (name) => fields[index[name]].trim();
  const woj = get("WOJ");
  const pow = get("POW");
  const gmi = get("GMI");
  const rodz = get("RODZ");
  const name = get("NAZWA");
  const stanNa = get("STAN_NA");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(stanNa)) fail(`line ${line}: unexpected STAN_NA "${stanNa}" (expected YYYY-MM-DD)`);
  stanNaValues.add(stanNa);
  if (!name) fail(`line ${line}: empty NAZWA`);
  if (!/^\d{2}$/.test(woj)) fail(`line ${line}: unexpected WOJ "${woj}"`);

  if (pow === "") {
    if (wojewodztwa.has(woj)) fail(`line ${line}: duplicate województwo ${woj}`);
    wojewodztwa.set(woj, name.toLocaleLowerCase("pl"));
  } else if (gmi === "") {
    if (!/^\d{2}$/.test(pow)) fail(`line ${line}: unexpected POW "${pow}"`);
    if (powiaty.has(woj + pow)) fail(`line ${line}: duplicate powiat ${woj}${pow}`);
    powiaty.set(woj + pow, name);
  } else if (rodz in KINDS) {
    const teryt = woj + pow + gmi + rodz;
    if (!/^[0-9]{6}[123]$/.test(teryt)) fail(`line ${line}: malformed teryt "${teryt}"`);
    units.push({ line, teryt, name, kind: KINDS[rodz], woj, pow });
  }
  // Other gmina-level units (RODZ 4, 5, 8, 9: town/rural parts, Warsaw districts, delegatury) are skipped.
});

// Checks before writing anything.
if (wojewodztwa.size !== EXPECTED_WOJEWODZTWA) {
  fail(`expected ${EXPECTED_WOJEWODZTWA} województwa, found ${wojewodztwa.size}`);
}
const seen = new Set();
const prefixes = new Map(); // WOJ+POW+GMI -> unit; the automatic successor relies on this prefix being unique
const gminas = units.map((unit) => {
  const powiat = powiaty.get(unit.woj + unit.pow);
  const wojewodztwo = wojewodztwa.get(unit.woj);
  if (!powiat) fail(`line ${unit.line}: gmina ${unit.teryt} (${unit.name}) has no powiat row ${unit.woj}${unit.pow}`);
  if (!wojewodztwo) fail(`line ${unit.line}: gmina ${unit.teryt} (${unit.name}) has no województwo row ${unit.woj}`);
  if (seen.has(unit.teryt)) fail(`line ${unit.line}: duplicate teryt ${unit.teryt}`);
  seen.add(unit.teryt);
  const prefix = unit.teryt.slice(0, 6);
  const other = prefixes.get(prefix);
  if (other) {
    fail(
      `line ${unit.line}: gmina ${unit.teryt} has the same WOJ+POW+GMI ${prefix} as ${other.teryt} (line ${other.line}); automatic successors need a unique prefix`,
    );
  }
  prefixes.set(prefix, unit);
  return { teryt: unit.teryt, name: unit.name, kind: unit.kind, powiat, wojewodztwo };
});
if (gminas.length < MIN_GMINAS || gminas.length > MAX_GMINAS) {
  fail(`expected between ${MIN_GMINAS} and ${MAX_GMINAS} gminas, found ${gminas.length}`);
}

gminas.sort((a, b) => (a.teryt < b.teryt ? -1 : a.teryt > b.teryt ? 1 : 0));
const stanNa = [...stanNaValues].sort().at(-1);

// An older TERC file would silently undo later changes, so refuse it. Assumes the migrations
// next to the output file match the production database (no database access here).
const outputDir = path.dirname(path.resolve(outputPath));
let migrationFiles;
try {
  migrationFiles = readdirSync(outputDir).filter((file) => file.endsWith(".sql"));
} catch (error) {
  fail(`cannot read the output directory ${outputDir}: ${error.message}`);
}
let latestStanNa = null;
let latestStanNaFile = null;
let latestMigration = null; // the generated SQL needs the columns added by earlier migrations, so it must run last
for (const file of migrationFiles) {
  if (path.resolve(outputDir, file) === path.resolve(outputPath)) continue; // the file being overwritten
  if (/^\d{14}_/.test(file) && (latestMigration === null || file > latestMigration)) latestMigration = file;
  let content;
  try {
    content = readFileSync(path.join(outputDir, file), "utf8");
  } catch (error) {
    fail(`cannot read ${path.join(outputDir, file)}: ${error.message}`);
  }
  for (const line of content.split(/\r?\n/)) {
    const value = STAN_NA_LINE.exec(line)?.[1];
    if (value && (latestStanNa === null || value > latestStanNa)) {
      latestStanNa = value;
      latestStanNaFile = file;
    }
  }
}
if (latestMigration !== null && outputFile.slice(0, 14) <= latestMigration.slice(0, 14)) {
  fail(
    `output timestamp ${outputFile.slice(0, 14)} must be later than the latest existing migration ${latestMigration}`,
  );
}
if (latestStanNa !== null && stanNa < latestStanNa) {
  fail(
    `STAN_NA of the TERC file (${stanNa}) is older than STAN_NA ${latestStanNa} in ${latestStanNaFile}; use a TERC file at least as recent`,
  );
}
if (latestStanNa === null) {
  console.warn(
    `WARNING: no "-- STAN_NA:" line found in ${outputDir}; the check against an older TERC file was skipped`,
  );
}

const outputRef = path.relative(process.cwd(), outputPath);
const outputShown =
  outputRef && !outputRef.startsWith("..") && !path.isAbsolute(outputRef)
    ? outputRef.split(path.sep).join("/")
    : path.basename(outputPath);
const maxRetiredArg = maxRetired === DEFAULT_MAX_RETIRED ? "" : ` --max-retired ${maxRetired}`;

const batches = [];
for (let i = 0; i < gminas.length; i += BATCH_SIZE) {
  const values = gminas
    .slice(i, i + BATCH_SIZE)
    .map((g) => `  (${[g.teryt, g.name, g.kind, g.powiat, g.wojewodztwo].map(sqlString).join(", ")})`);
  batches.push(`insert into gminas_terc (teryt, name, kind, powiat, wojewodztwo) values\n${values.join(",\n")};\n`);
}

// Order matters: the threshold check runs before any change, so an abort leaves the table untouched even
// outside a transaction. The upsert runs before retiring, so every successor exists (FK) before replaced_by
// points at it, and reactivated gminas get active = true and replaced_by = null in one statement (check constraint).
// The successor of a retired gmina is the TERC code with the same WOJ+POW+GMI and a different RODZ.
// Caregiver gminas are re-pointed last, after retiring and chain shortening, so replaced_by is final by then.
const sync = `-- ---------------------------------------------------------------------------
-- Threshold: abort before any change if more than max_retired gminas would be retired without a successor.
-- The upsert does not touch gminas missing from TERC, so the count is the same as after it.
-- ---------------------------------------------------------------------------
do $$
declare
  max_retired constant integer := ${maxRetired};
  orphan_count integer;
  orphan_list text;
begin
  select count(*), string_agg(g.teryt, ', ' order by g.teryt)
  into orphan_count, orphan_list
  from public.gminas as g
  where g.active
    and not exists (select 1 from gminas_terc as t where t.teryt = g.teryt)
    and not exists (select 1 from gminas_terc as t where left(t.teryt, 6) = left(g.teryt, 6));

  if orphan_count > max_retired then
    raise exception 'gminas sync aborted: % gminas would be retired without a successor (max %): %. If this is a real administrative reform, regenerate the migration with --max-retired N.',
      orphan_count, max_retired, orphan_list;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Upsert: add new gminas, update existing ones, reactivate gminas back in TERC.
-- ---------------------------------------------------------------------------
insert into public.gminas (teryt, name, kind, powiat, wojewodztwo)
select teryt, name, kind, powiat, wojewodztwo
from gminas_terc
on conflict (teryt) do update set
  name = excluded.name,
  kind = excluded.kind,
  powiat = excluded.powiat,
  wojewodztwo = excluded.wojewodztwo,
  active = true,
  replaced_by = null;

-- ---------------------------------------------------------------------------
-- Retire active gminas missing from TERC (rows are never deleted).
-- ---------------------------------------------------------------------------
do $$
declare
  retired_codes text[];
  successor_codes text[];
  orphan_list text;
  replaced_list text;
  shortened_count integer;
begin
  select
    coalesce(array_agg(g.teryt order by g.teryt), '{}'),
    coalesce(array_agg((
      select t.teryt
      from gminas_terc as t
      where left(t.teryt, 6) = left(g.teryt, 6)
        and t.teryt <> g.teryt
    ) order by g.teryt), '{}')
  into retired_codes, successor_codes
  from public.gminas as g
  where g.active
    and not exists (select 1 from gminas_terc as t where t.teryt = g.teryt);

  select string_agg(r.old_teryt, ', ' order by r.old_teryt)
  into orphan_list
  from unnest(retired_codes, successor_codes) as r (old_teryt, new_teryt)
  where r.new_teryt is null;

  update public.gminas as g
  set active = false,
      replaced_by = r.new_teryt
  from unnest(retired_codes, successor_codes) as r (old_teryt, new_teryt)
  where g.teryt = r.old_teryt;

  -- Shorten chains: gminas retired earlier that pointed at a gmina retired now get its successor.
  update public.gminas as g
  set replaced_by = r.new_teryt
  from unnest(retired_codes, successor_codes) as r (old_teryt, new_teryt)
  where not g.active
    and g.replaced_by = r.old_teryt
    and r.new_teryt is not null;
  get diagnostics shortened_count = row_count;

  if cardinality(retired_codes) = 0 then
    raise notice 'gminas sync: no gminas retired';
  else
    select string_agg(r.old_teryt || ' -> ' || r.new_teryt, ', ' order by r.old_teryt)
    into replaced_list
    from unnest(retired_codes, successor_codes) as r (old_teryt, new_teryt)
    where r.new_teryt is not null;

    raise notice 'gminas sync: retired % gminas; with successor: %; without successor: %; shortened successor chains: %',
      cardinality(retired_codes), coalesce(replaced_list, 'none'), coalesce(orphan_list, 'none'), shortened_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-point caregiver gminas from retired gminas to their active successors.
-- Insert first, then delete: a caregiver who already has the successor, or two retired gminas with the same
-- successor, do not break the primary key. Links to a retired gmina without an active successor are left
-- as they are and listed in the notice, to be resolved by hand.
-- ---------------------------------------------------------------------------
do $$
declare
  repointed_count integer;
  left_count integer;
  left_list text;
begin
  insert into public.caregiver_gminas (caregiver_id, teryt)
  select distinct cg.caregiver_id, n.teryt
  from public.caregiver_gminas as cg
  join public.gminas as g on g.teryt = cg.teryt and not g.active
  join public.gminas as n on n.teryt = g.replaced_by and n.active
  on conflict do nothing;

  delete from public.caregiver_gminas as cg
  using public.gminas as g
  join public.gminas as n on n.teryt = g.replaced_by and n.active
  where cg.teryt = g.teryt and not g.active;
  get diagnostics repointed_count = row_count;

  select count(*), string_agg(distinct cg.teryt, ', ' order by cg.teryt)
  into left_count, left_list
  from public.caregiver_gminas as cg
  join public.gminas as g on g.teryt = cg.teryt
  where not g.active;

  raise notice 'gminas sync: re-pointed % caregiver gmina links to active successors; % links left on retired gminas without an active successor: %',
    repointed_count, left_count, coalesce(left_list, 'none');
end;
$$;

drop table gminas_terc;
`;

const sql = [
  `-- Migration: ${migrationName}`,
  "-- GENERATED FILE - do not edit by hand. Regenerate from a newer TERC file instead.",
  "-- Source: GUS TERYT, TERC (wersja urzędowa, CSV), eteryt.stat.gov.pl -> Pobieranie plików",
  `-- STAN_NA: ${stanNa}`,
  `-- Generated with: node scripts/generate-gminas-migration.mjs ${commentSafe(path.basename(inputPath))} ${commentSafe(outputShown)}${maxRetiredArg}`,
  `-- Rows: ${gminas.length} gminas (TERC RODZ 1 miejska, 2 wiejska, 3 miejsko-wiejska)`,
  `-- Mode: sync (upsert from TERC, retire gminas missing from TERC; max retired without successor: ${maxRetired})`,
  "",
  "create temporary table gminas_terc (teryt text primary key, name text not null, kind text not null, powiat text not null, wojewodztwo text not null);",
  "",
  ...batches,
  sync,
].join("\n");

try {
  writeFileSync(outputPath, sql, "utf8");
} catch (error) {
  fail(`cannot write ${outputPath}: ${error.message}`);
}

const byKind = Object.values(KINDS)
  .map((kind) => `${kind} ${gminas.filter((g) => g.kind === kind).length}`)
  .join(", ");
console.log(`STAN_NA: ${stanNa}`);
if (stanNaValues.size > 1) console.log(`  (file has ${stanNaValues.size} STAN_NA values; using the latest)`);
console.log(`gminas: ${gminas.length} (${byKind})`);
console.log(`migration: ${migrationName}`);
console.log(`max retired: ${maxRetired}`);
console.log(`written: ${outputPath}`);
