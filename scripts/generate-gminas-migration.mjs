// Generates the gminas data migration from the official GUS TERYT TERC file (wersja urzędowa, CSV).
// Zero dependencies on purpose. Re-run with a newer TERC file to pick up administrative changes:
//   node scripts/generate-gminas-migration.mjs <path-to-TERC.csv> supabase/migrations/<YYYYMMDDHHmmss>_seed_gminas.sql
// Download: eteryt.stat.gov.pl -> "Pobieranie plików" -> TERC, wersja urzędowa, CSV. Do not commit the raw CSV.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const KINDS = { 1: "miejska", 2: "wiejska", 3: "miejsko-wiejska" };
const REQUIRED_COLUMNS = ["WOJ", "POW", "GMI", "RODZ", "NAZWA", "NAZWA_DOD", "STAN_NA"];
const EXPECTED_WOJEWODZTWA = 16;
const MIN_GMINAS = 2470;
const MAX_GMINAS = 2490;
const BATCH_SIZE = 500;

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

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || process.argv.length > 4) {
  fail("usage: node scripts/generate-gminas-migration.mjs <path-to-TERC.csv> <output.sql>");
}

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
const gminas = units.map((unit) => {
  const powiat = powiaty.get(unit.woj + unit.pow);
  const wojewodztwo = wojewodztwa.get(unit.woj);
  if (!powiat) fail(`line ${unit.line}: gmina ${unit.teryt} (${unit.name}) has no powiat row ${unit.woj}${unit.pow}`);
  if (!wojewodztwo) fail(`line ${unit.line}: gmina ${unit.teryt} (${unit.name}) has no województwo row ${unit.woj}`);
  if (seen.has(unit.teryt)) fail(`line ${unit.line}: duplicate teryt ${unit.teryt}`);
  seen.add(unit.teryt);
  return { teryt: unit.teryt, name: unit.name, kind: unit.kind, powiat, wojewodztwo };
});
if (gminas.length < MIN_GMINAS || gminas.length > MAX_GMINAS) {
  fail(`expected between ${MIN_GMINAS} and ${MAX_GMINAS} gminas, found ${gminas.length}`);
}

gminas.sort((a, b) => (a.teryt < b.teryt ? -1 : a.teryt > b.teryt ? 1 : 0));
const stanNa = [...stanNaValues].sort().at(-1);
const outputRef = path.relative(process.cwd(), outputPath);
const outputShown =
  outputRef && !outputRef.startsWith("..") && !path.isAbsolute(outputRef)
    ? outputRef.split(path.sep).join("/")
    : path.basename(outputPath);

const batches = [];
for (let i = 0; i < gminas.length; i += BATCH_SIZE) {
  const values = gminas
    .slice(i, i + BATCH_SIZE)
    .map((g) => `  (${[g.teryt, g.name, g.kind, g.powiat, g.wojewodztwo].map(sqlString).join(", ")})`);
  batches.push(`insert into public.gminas (teryt, name, kind, powiat, wojewodztwo) values\n${values.join(",\n")};\n`);
}

const sql = [
  "-- Migration: seed_gminas",
  "-- GENERATED FILE - do not edit by hand. Regenerate from a newer TERC file instead.",
  "-- Source: GUS TERYT, TERC (wersja urzędowa, CSV), eteryt.stat.gov.pl -> Pobieranie plików",
  `-- STAN_NA: ${stanNa}`,
  `-- Generated with: node scripts/generate-gminas-migration.mjs ${path.basename(inputPath)} ${outputShown}`,
  `-- Rows: ${gminas.length} gminas (TERC RODZ 1 miejska, 2 wiejska, 3 miejsko-wiejska)`,
  "",
  ...batches,
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
console.log(`written: ${outputPath}`);
