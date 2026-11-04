// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, the public dictionaries
// and the caregiver profile API and pages still work together, that RLS keeps contact data away from anon, from other caregivers
// and from coordinators unless the profile is complete, and that the public caregiver list (search_caregivers) and the single
// public profile (get_public_caregiver) hide incomplete profiles and expose no contact data.
// The list filters hard only by gmina: with selected services a profile must offer at least one of them, and the
// selected services, then the selected slots, set the order (ranking); every row carries what it is missing
// (missing_services, missing_slots), and the empty-result hint counts come from one RPC (count_caregivers_relaxed).
// The pages /opiekunowie/<id> (public, no contact in the HTML) and /kontakt/<id> (protected, contact for coordinators only)
// close the path from the list to a revealed phone number, including a new coordinator signing up with a return address.
// Table privileges are checked too: anon and authenticated get only the explicit grants, so reads of contacts and roles
// by anon and writes to the dictionaries fail with "permission denied" before RLS is even consulted.
// Caregiver availability (caregiver_availability) is public to read, written only by its owner through save_caregiver_profile(),
// and never hides a profile from the search. On the pages: the list filter (termin), the availability line on cards,
// the match line on cards (missing services and slots, full match first), the relax hints and the grid on the
// public profile page.
// Profile deletion (caregiver_profiles delete policy): only the owner deletes their profile (anon has no privilege,
// another caregiver and a coordinator delete nothing), the foreign key cascade clears the contact, gminas, services
// and availability, and the profile is gone from search_caregivers and get_public_caregiver at once. Through the app:
// DELETE /api/caregiver/profile (401 without a session, 403 for a coordinator, 200 for the owner, 404 the second time),
// the "Usuń profil" button and the deletion message on /profil, and the deleted profile's 404 page and absence from the list.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 npm run smoke
// npm run smoke loads SUPABASE_URL/SUPABASE_KEY (anon key) from .env; the RLS steps call Supabase directly with them.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_KEY (anon key) are required: put them in .env or in the environment.");
  process.exit(1);
}

const stamp = Date.now();
const email = `smoke-${stamp}@example.com`;
const coordinatorEmail = `smoke-coordinator-${stamp}@example.com`;
const secondCaregiverEmail = `smoke-caregiver2-${stamp}@example.com`;
const thirdCaregiverEmail = `smoke-caregiver3-${stamp}@example.com`;
const secondCoordinatorEmail = `smoke-coordinator2-${stamp}@example.com`;
// Fourth caregiver: a complete profile that the REST steps delete, so the profiles of other steps stay untouched.
const deletableCaregiverEmail = `smoke-caregiver4-${stamp}@example.com`;
// Contact e-mail of the first caregiver: differs from the login e-mail, so absence checks look for the real value.
const contactEmail = `kontakt-${stamp}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();
// Filled in by earlier steps, used by later ones.
let caregiverId = "";
let coordinatorId = "";
let coordinatorToken = "";
let secondCaregiverToken = "";
let secondCaregiverId = "";
// Third caregiver: saves a profile without a phone, so it stays incomplete.
let incompleteCaregiverId = "";
let incompleteCaregiverToken = "";
// Fourth caregiver: its profile is deleted by its owner.
let deletableCaregiverId = "";
let deletableCaregiverToken = "";
// Fifth caregiver ("Ewa Smoke"): signs up through the app and deletes its profile through the API.
const appDeletableCaregiverEmail = `smoke-caregiver5-${stamp}@example.com`;
let appDeletableCaregiverId = "";

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function readResponse(response) {
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    headers: response.headers,
    json: isJson ? await response.json() : undefined,
    // Body of non-JSON responses (HTML pages); empty for JSON.
    text: isJson ? "" : await response.text(),
  };
}

async function request(path, { method = "GET", form, json } = {}) {
  const contentType = form ? "application/x-www-form-urlencoded" : json ? "application/json" : undefined;
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  storeCookies(response);
  return readResponse(response);
}

// Direct call to Supabase (PostgREST or Auth), bypassing the app: as anon, or as a user when a token is given.
// prefer: PostgREST Prefer header, e.g. "return=representation" to get the deleted rows back.
async function supabase(path, { method = "GET", token, json, prefer } = {}) {
  const response = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_KEY}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  return readResponse(response);
}

const isEmptyArray = (json) => Array.isArray(json) && json.length === 0;
const hasOneRow = (json) => Array.isArray(json) && json.length === 1;
// Missing table privilege, not an RLS denial: both use code 42501, only the message tells them apart.
const deniesTable = (table) => (json) =>
  json?.code === "42501" &&
  typeof json.message === "string" &&
  json.message.includes(`permission denied for table ${table}`);

// Public caregiver list straight from the database, as anon (no token) unless one is given.
const searchCaregivers = (args) => supabase("/rest/v1/rpc/search_caregivers", { method: "POST", json: args });
// One public caregiver profile straight from the database, as anon unless a token is given.
const getPublicCaregiver = (id) =>
  supabase("/rest/v1/rpc/get_public_caregiver", { method: "POST", json: { p_caregiver_id: id } });
// Empty-result hint counts (without services, without gmina) in one row, as anon.
const countRelaxed = (args) => supabase("/rest/v1/rpc/count_caregivers_relaxed", { method: "POST", json: args });
const listsCaregiver = (json) => Array.isArray(json) && json.some((row) => row.user_id === caregiverId);
const hidesCaregiver = (json) => Array.isArray(json) && !json.some((row) => row.user_id === caregiverId);
const findFirstCaregiver = (json) =>
  Array.isArray(json) ? json.find((row) => row.user_id === caregiverId) : undefined;
const findSecondCaregiver = (json) =>
  Array.isArray(json) ? json.find((row) => row.user_id === secondCaregiverId) : undefined;
// Ranking order of search_caregivers(): (matched_services, matched_slots) never increases from row to row, and
// within an equal pair updated_at never increases. Positions of particular profiles are not checked: the local
// database collects the smoke profiles of every run. updated_at is compared as a date, not as text: PostgREST
// returns timestamptz with a varying number of fraction digits.
const rankedInOrder = (json) =>
  Array.isArray(json) &&
  json.every((row, index) => {
    if (index === 0) return true;
    const previous = json[index - 1];
    if (previous.matched_services !== row.matched_services) return previous.matched_services > row.matched_services;
    if (previous.matched_slots !== row.matched_slots) return previous.matched_slots > row.matched_slots;
    return Date.parse(previous.updated_at) >= Date.parse(row.updated_at);
  });
// Same availability slots regardless of order (SQL orders by slot text; the app sets the canonical order).
const sameSlots = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  [...actual].sort().join() === [...expected].sort().join();
const CONTACT_KEYS = ["phone", "email", "caregiver_contacts"];
const hasNoindex = (headers) => (headers.get("x-robots-tag") ?? "").includes("noindex");
// The first caregiver's phone in every form plus the contact and login e-mails: none may appear on the public list.
const hidesListContact = (text) =>
  ["600 100 200", "600100200", "+48600100200", contactEmail, email].every((secret) => !text.includes(secret));
// The first caregiver's contact as it could appear on its public profile page.
const hidesProfileContact = (text) =>
  [contactEmail, "+48600100200", "600100200", "600 100 200"].every((secret) => !text.includes(secret));
// One caregiver's card, from its name to the next card (or end of page): scopes a match-line assertion to a
// single profile, since the local database collects cards from every smoke run.
const cardFragment = (text, name) => {
  const start = text.indexOf(name);
  if (start === -1) return "";
  const next = text.indexOf("<article", start);
  return text.slice(start, next === -1 ? text.length : next);
};

const completeProfile = {
  displayName: "Anna Smoke",
  description: "",
  phone: "600 100 200",
  email: contactEmail,
  gminas: ["1465011"],
  services: ["towarzystwo"],
  // Out of order and with a duplicate: the API returns it deduplicated, in canonical order (Pn–Pt rano, Sb noc).
  availability: ["sob-noc", "pon-rano", "wt-rano", "sr-rano", "czw-rano", "pt-rano", "pon-rano"],
};

// Second caregiver's profile, saved straight through the RPC in the previous 6-parameter shape (no p_availability).
const secondCaregiverProfile = {
  p_display_name: "Bartek Smoke",
  p_description: null,
  p_phone: "+48600100300",
  p_email: null,
  p_gminas: ["1465011"],
  // One service more than "Anna Smoke" (towarzystwo), so Bartek ranks above her when both are selected.
  p_services: ["towarzystwo", "zakupy-i-sprawy"],
};

const steps = [
  // Dictionaries first: they must work for an anonymous user (no session cookie yet).
  [
    "services dictionary lists 13 services",
    () => request("/api/dictionaries/services"),
    { status: 200, body: (json) => json.services?.length === 13 && json.services[0]?.slug === "towarzystwo" },
  ],
  [
    "gminas search ignores diacritics",
    () => request("/api/dictionaries/gminas?q=lodz"),
    { status: 200, body: (json) => json.gminas?.some((g) => g.teryt === "1061011") === true },
  ],
  [
    "gminas search ranks exact prefix first",
    () => request("/api/dictionaries/gminas?q=warszawa"),
    { status: 200, body: (json) => json.gminas?.[0]?.teryt === "1465011" },
  ],
  ["gminas search rejects too short query", () => request("/api/dictionaries/gminas?q=a"), { status: 400 }],
  [
    "home renders",
    () => request("/"),
    { status: 200, headers: hasNoindex, html: (text) => text.includes('href="/opiekunowie"') },
  ],
  [
    "dashboard redirects anonymous user",
    () => request("/dashboard"),
    // exact: the redirect carries the page the anonymous user came from.
    { status: 302, location: "/auth/signin?next=%2Fdashboard", exact: true },
  ],
  [
    "signup rejects missing role",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/signup?error=" },
  ],
  [
    "signup creates caregiver account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, role: "caregiver" } }),
    { status: 302, location: "/profil/edycja" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin sends caregiver to profile",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    // exact: "/profil/edycja" would also start with "/profil".
    { status: 302, location: "/profil", exact: true },
  ],
  // The return address ("next"), while the caregiver is signed in: it wins over the role's default page, external
  // targets are ignored (the default page applies), and a failed sign-in keeps it.
  [
    "signin returns to next",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "/dashboard" } }),
    { status: 302, location: "/dashboard", exact: true },
  ],
  [
    "signin ignores external next (protocol-relative)",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "//evil.example" } }),
    { status: 302, location: "/profil", exact: true },
  ],
  [
    "signin ignores external next (backslash)",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "/\\evil.example" } }),
    { status: 302, location: "/profil", exact: true },
  ],
  [
    "signin ignores external next (dot segments)",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "/.//evil.example" } }),
    { status: 302, location: "/profil", exact: true },
  ],
  [
    "signin ignores external next (absolute URL)",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "https://evil.example" } }),
    { status: 302, location: "/profil", exact: true },
  ],
  [
    "signin error keeps next",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong", next: "/dashboard" } }),
    { status: 302, location: "/auth/signin?error=", locationIncludes: "next=%2Fdashboard" },
  ],
  [
    "signin page carries next",
    () => request("/auth/signin?next=%2Fdashboard"),
    {
      status: 200,
      html: (text) => text.includes('name="next"') && text.includes('href="/auth/signup?next=%2Fdashboard"'),
    },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["profile edit page renders for caregiver", () => request("/profil/edycja"), { status: 200 }],
  [
    "new caregiver has no profile yet",
    () => request("/api/caregiver/profile"),
    { status: 200, body: (json) => json.profile === null },
  ],
  [
    "profile save rejects invalid phone",
    () => request("/api/caregiver/profile", { method: "PUT", json: { ...completeProfile, phone: "12345" } }),
    { status: 400, body: (json) => typeof json.fieldErrors?.phone === "string" },
  ],
  [
    "profile save without phone leaves profile incomplete",
    async () => {
      const result = await request("/api/caregiver/profile", {
        method: "PUT",
        json: { ...completeProfile, phone: "" },
      });
      caregiverId = result.json?.profile?.id ?? "";
      return result;
    },
    {
      status: 200,
      body: (json) => typeof json.profile?.id === "string" && json.profile.missing?.includes("phone") === true,
    },
  ],
  [
    "search hides incomplete profile",
    () => searchCaregivers({ p_teryt: "1465011", p_limit: 50 }),
    { status: 200, body: hidesCaregiver },
  ],
  [
    "profile save normalizes phone and completes profile",
    async () => {
      const result = await request("/api/caregiver/profile", { method: "PUT", json: completeProfile });
      caregiverId = result.json?.profile?.id ?? "";
      return result;
    },
    {
      status: 200,
      body: (json) =>
        json.profile?.displayName === "Anna Smoke" &&
        json.profile.contact?.phone === "+48600100200" &&
        isEmptyArray(json.profile.missing) &&
        JSON.stringify(json.profile.availability) ===
          JSON.stringify(["pon-rano", "wt-rano", "sr-rano", "czw-rano", "pt-rano", "sob-noc"]),
    },
  ],
  [
    "profile save rejects unknown availability slot (API)",
    () =>
      request("/api/caregiver/profile", { method: "PUT", json: { ...completeProfile, availability: ["pon-swit"] } }),
    { status: 400, body: (json) => typeof json.fieldErrors?.availability === "string" },
  ],
  ["profile page renders for caregiver", () => request("/profil"), { status: 200 }],
  // RLS and table privileges, straight against Supabase as anon: the public part is readable, contact data and roles
  // are not even granted (PostgREST answers 401 for anon), and the dictionaries cannot be written.
  [
    "anon reads public caregiver profile",
    () => supabase(`/rest/v1/caregiver_profiles?user_id=eq.${caregiverId}`),
    { status: 200, body: hasOneRow },
  ],
  [
    "anon reads caregiver gminas",
    () => supabase(`/rest/v1/caregiver_gminas?caregiver_id=eq.${caregiverId}`),
    { status: 200, body: hasOneRow },
  ],
  [
    "anon cannot read caregiver contact",
    () => supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${caregiverId}`),
    { status: 401, body: deniesTable("caregiver_contacts") },
  ],
  [
    "anon cannot read account roles",
    () => supabase("/rest/v1/accounts"),
    { status: 401, body: deniesTable("accounts") },
  ],
  [
    "anon cannot write gminas dictionary",
    () =>
      supabase("/rest/v1/gminas", {
        method: "POST",
        // Existing columns only (an unknown one is a 400 PGRST204); the privilege check comes before any constraint.
        json: { teryt: "9999991", name: "Smoke", kind: "wiejska", powiat: "smoke", wojewodztwo: "smoke" },
      }),
    { status: 401, body: deniesTable("gminas") },
  ],
  [
    "anon sees the profile as complete",
    () => supabase("/rest/v1/rpc/caregiver_profile_missing", { method: "POST", json: { p_caregiver_id: caregiverId } }),
    { status: 200, body: isEmptyArray },
  ],
  [
    "search lists complete profile in its gmina",
    () => searchCaregivers({ p_teryt: "1465011", p_limit: 50 }),
    {
      status: 200,
      body: (json) => {
        const serialized = JSON.stringify(json);
        return (
          listsCaregiver(json) &&
          json.every((row) => CONTACT_KEYS.every((key) => !(key in row))) &&
          !serialized.includes(contactEmail) &&
          !serialized.includes("+48600100200")
        );
      },
    },
  ],
  [
    "search hides profile in other gmina",
    () => searchCaregivers({ p_teryt: "1061011", p_limit: 50 }),
    { status: 200, body: hidesCaregiver },
  ],
  [
    "search ranks profile missing a selected service",
    () => searchCaregivers({ p_teryt: "1465011", p_services: ["towarzystwo", "demencja"], p_limit: 50 }),
    {
      status: 200,
      body: (json) => {
        const row = findFirstCaregiver(json);
        return (
          row?.matched_services === 1 &&
          Array.isArray(row.missing_services) &&
          row.missing_services.some((service) => service.slug === "demencja")
        );
      },
    },
  ],
  [
    "search matches selected service",
    () => searchCaregivers({ p_teryt: "1465011", p_services: ["towarzystwo"], p_limit: 50 }),
    { status: 200, body: listsCaregiver },
  ],
  [
    "second caregiver gets Supabase access token",
    async () => {
      const result = await supabase("/auth/v1/signup", {
        method: "POST",
        json: { email: secondCaregiverEmail, password, data: { role: "caregiver" } },
      });
      secondCaregiverToken = result.json?.access_token ?? "";
      secondCaregiverId = result.json?.user?.id ?? "";
      return result;
    },
    { status: 200, body: (json) => typeof json.access_token === "string" && typeof json.user?.id === "string" },
  ],
  [
    "signed-in user cannot write services dictionary",
    () =>
      supabase("/rest/v1/services", {
        method: "POST",
        token: secondCaregiverToken,
        json: { slug: "smoke", label: "Smoke", sort_order: 999 },
      }),
    // PostgREST answers 403 for authenticated; the message proves it is the missing grant, not RLS.
    { status: 403, body: deniesTable("services") },
  ],
  [
    "second caregiver saves complete profile",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: secondCaregiverToken,
        json: { ...secondCaregiverProfile, p_availability: ["sr-noc", "nd-wieczor"] },
      }),
    { status: 204 },
  ],
  // Availability straight against Supabase: public to read, written only by its owner, validated by
  // save_caregiver_profile(), and in the search selected slots only set the order (they never hide a profile).
  [
    "anon reads caregiver availability",
    () => supabase(`/rest/v1/caregiver_availability?caregiver_id=eq.${secondCaregiverId}`),
    { status: 200, body: (json) => Array.isArray(json) && json.length === 2 },
  ],
  [
    "anon cannot write caregiver availability",
    () =>
      supabase("/rest/v1/caregiver_availability", {
        method: "POST",
        json: { caregiver_id: secondCaregiverId, slot: "pon-rano" },
      }),
    { status: 401, body: deniesTable("caregiver_availability") },
  ],
  [
    "caregiver cannot write another caregiver's availability",
    () =>
      supabase("/rest/v1/caregiver_availability", {
        method: "POST",
        token: secondCaregiverToken,
        json: { caregiver_id: caregiverId, slot: "pon-rano" },
      }),
    // 403 with the RLS message: the grant allows insert, the policy rejects someone else's caregiver_id.
    {
      status: 403,
      body: (json) => json?.code === "42501" && String(json.message).includes("row-level security"),
    },
  ],
  [
    "profile save rejects unknown availability slot",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: secondCaregiverToken,
        json: { ...secondCaregiverProfile, p_availability: ["pon-swit"] },
      }),
    { status: 400, body: (json) => String(json?.message).includes("Nieznane terminy dostępności") },
  ],
  [
    "search ranks profiles by covered slots",
    () => searchCaregivers({ p_teryt: "1465011", p_availability: ["sr-noc", "czw-noc"], p_limit: 50 }),
    {
      status: 200,
      body: (json) => {
        const second = findSecondCaregiver(json);
        return (
          second?.matched_slots === 1 &&
          sameSlots(second.missing_slots, ["czw-noc"]) &&
          sameSlots(second.availability, ["nd-wieczor", "sr-noc"]) &&
          listsCaregiver(json) &&
          findFirstCaregiver(json)?.matched_slots === 0 &&
          rankedInOrder(json)
        );
      },
    },
  ],
  [
    "search keeps profile without matching slot",
    () => searchCaregivers({ p_teryt: "1465011", p_availability: ["czw-noc"], p_limit: 50 }),
    {
      status: 200,
      body: (json) => {
        const second = findSecondCaregiver(json);
        return second?.matched_slots === 0 && sameSlots(second.missing_slots, ["czw-noc"]);
      },
    },
  ],
  [
    "search hides profile without any selected service",
    // "Anna Smoke" offers only towarzystwo: with services selected, at least one of them must match.
    () => searchCaregivers({ p_teryt: "1465011", p_services: ["demencja"], p_limit: 50 }),
    { status: 200, body: hidesCaregiver },
  ],
  [
    "search ranks services above availability",
    // Bartek covers both services and no slot (2, 0), Anna one service and the slot (1, 1): services win.
    () =>
      searchCaregivers({
        p_teryt: "1465011",
        p_services: ["towarzystwo", "zakupy-i-sprawy"],
        p_availability: ["pon-rano"],
        p_limit: 50,
      }),
    {
      status: 200,
      body: (json) => {
        const second = findSecondCaregiver(json);
        const first = findFirstCaregiver(json);
        const secondIndex = Array.isArray(json) ? json.indexOf(second) : -1;
        const firstIndex = Array.isArray(json) ? json.indexOf(first) : -1;
        return (
          second?.matched_services === 2 &&
          second.matched_slots === 0 &&
          (first === undefined || (first.matched_services === 1 && first.matched_slots === 1)) &&
          rankedInOrder(json) &&
          (first === undefined || secondIndex < firstIndex)
        );
      },
    },
  ],
  [
    "relaxed counts come in one row",
    async () => {
      const inGmina = await countRelaxed({ p_teryt: "1465011", p_services: ["demencja"] });
      const anyGmina = await countRelaxed({ p_services: ["demencja"] });
      const ok =
        inGmina.status === 200 &&
        hasOneRow(inGmina.json) &&
        Number(inGmina.json[0].without_services) >= 2 &&
        typeof inGmina.json[0].without_gmina === "number" &&
        anyGmina.status === 200 &&
        hasOneRow(anyGmina.json) &&
        typeof anyGmina.json[0].without_services === "number" &&
        anyGmina.json[0].without_gmina === null;
      return { ...inGmina, json: { ok, inGmina: inGmina.json, anyGmina: anyGmina.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "public caregiver returns availability",
    () => getPublicCaregiver(secondCaregiverId),
    {
      status: 200,
      body: (json) =>
        hasOneRow(json) &&
        sameSlots(json[0].availability, ["nd-wieczor", "sr-noc"]) &&
        CONTACT_KEYS.every((key) => !(key in json[0])),
    },
  ],
  [
    "profile save without availability keeps it",
    // The 6-parameter shape (what a Worker from before S-04 sends): p_availability defaults to null = unchanged,
    // so rolling the Worker back does not wipe availability.
    async () => {
      const saved = await supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: secondCaregiverToken,
        json: secondCaregiverProfile,
      });
      const listed = await searchCaregivers({ p_teryt: "1465011", p_limit: 50 });
      const ok =
        saved.status === 204 &&
        listed.status === 200 &&
        sameSlots(findSecondCaregiver(listed.json)?.availability, ["nd-wieczor", "sr-noc"]);
      return { ...listed, json: { ok, saved: saved.status, listed: listed.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "profile save with empty availability clears it",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: secondCaregiverToken,
        json: { ...secondCaregiverProfile, p_availability: [] },
      }),
    { status: 204 },
  ],
  [
    "search without availability filter keeps profile without availability",
    async () => {
      const unfiltered = await searchCaregivers({ p_teryt: "1465011", p_limit: 50 });
      const filtered = await searchCaregivers({ p_teryt: "1465011", p_availability: ["sr-noc"], p_limit: 50 });
      // Slots never hide a profile: with the filter Bartek stays, with nothing covered and the slot missing.
      const filteredSecond = findSecondCaregiver(filtered.json);
      const ok =
        unfiltered.status === 200 &&
        isEmptyArray(findSecondCaregiver(unfiltered.json)?.availability) &&
        filtered.status === 200 &&
        filteredSecond?.matched_slots === 0 &&
        sameSlots(filteredSecond.missing_slots, ["sr-noc"]);
      return { ...unfiltered, json: { ok, unfiltered: unfiltered.json, filtered: filtered.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "second caregiver cannot read first caregiver contact",
    () => supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${caregiverId}`, { token: secondCaregiverToken }),
    { status: 200, body: isEmptyArray },
  ],
  [
    "third caregiver gets Supabase access token",
    async () => {
      const result = await supabase("/auth/v1/signup", {
        method: "POST",
        json: { email: thirdCaregiverEmail, password, data: { role: "caregiver" } },
      });
      incompleteCaregiverToken = result.json?.access_token ?? "";
      incompleteCaregiverId = result.json?.user?.id ?? "";
      return result;
    },
    { status: 200, body: (json) => typeof json.access_token === "string" && typeof json.user?.id === "string" },
  ],
  [
    "third caregiver saves incomplete profile without phone",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: incompleteCaregiverToken,
        json: {
          p_display_name: "Celina Smoke",
          p_description: null,
          p_phone: null,
          p_email: `kontakt3-${stamp}@example.com`,
          p_gminas: ["1465011"],
          p_services: ["towarzystwo"],
        },
      }),
    { status: 204 },
  ],
  // The single public profile, as anon: complete profile without contact data, incomplete profile hidden.
  [
    "anon reads public caregiver",
    () => getPublicCaregiver(caregiverId),
    {
      status: 200,
      body: (json) => {
        const serialized = JSON.stringify(json);
        return (
          hasOneRow(json) &&
          json[0].user_id === caregiverId &&
          CONTACT_KEYS.every((key) => !(key in json[0])) &&
          !serialized.includes(contactEmail) &&
          !serialized.includes("+48600100200")
        );
      },
    },
  ],
  [
    "public caregiver hides incomplete profile",
    () => getPublicCaregiver(incompleteCaregiverId),
    { status: 200, body: isEmptyArray },
  ],
  [
    "search counts matches before the limit",
    () => searchCaregivers({ p_teryt: "1465011", p_limit: 1 }),
    { status: 200, body: (json) => hasOneRow(json) && Number(json[0].total_count) >= 2 },
  ],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  // The public caregiver list, as anonymous user (the session was just cleared).
  [
    "caregiver list renders for anonymous user",
    () => request("/opiekunowie?gmina=1465011"),
    {
      status: 200,
      headers: hasNoindex,
      html: (text) => text.includes("Anna Smoke") && hidesListContact(text),
    },
  ],
  // Availability on the list, as anonymous user: "Anna Smoke" has Pn–Pt rano + Sb noc, "Bartek Smoke" has none.
  // A slot nobody has (czw-noc) hides nobody, so there is no empty result and no relax hint.
  [
    "caregiver list keeps profiles without matching slot",
    () => request("/opiekunowie?gmina=1465011&termin=czw-noc"),
    {
      status: 200,
      html: (text) =>
        text.includes("Anna Smoke") &&
        text.includes("Pn–Pt: rano · Sb: noc") &&
        text.includes("Bartek Smoke") &&
        text.includes("Brakuje terminów: Cz: noc") &&
        !text.includes("Usuń filtr dostępności") &&
        hidesListContact(text),
    },
  ],
  [
    "caregiver list marks full matches first",
    // "Anna Smoke" has pon-rano (full match); profiles without it rank lower and show what they miss.
    () => request("/opiekunowie?gmina=1465011&termin=pon-rano"),
    {
      status: 200,
      html: (text) => {
        const firstFull = text.indexOf("Pełne dopasowanie");
        const firstMissing = text.indexOf("Brakuje terminów");
        return (
          text.includes("Anna Smoke") &&
          firstFull !== -1 &&
          (firstMissing === -1 || firstFull < firstMissing) &&
          hidesListContact(text)
        );
      },
    },
  ],
  [
    "caregiver list names missing services",
    () => request("/opiekunowie?gmina=1465011&usluga=towarzystwo&usluga=demencja"),
    { status: 200, html: (text) => text.includes("Brakuje usług: Opieka nad osobą z demencją") },
  ],
  [
    "caregiver list shows missing availability",
    () => request("/opiekunowie?gmina=1465011"),
    { status: 200, html: (text) => text.includes("Bartek Smoke") && text.includes("Dostępność nie podana") },
  ],
  [
    "caregiver list orders missing terms canonically and hides full match for it",
    // "Anna Smoke" has neither czw-noc nor pon-noc (textual order would put czw- before pon-; the app orders by
    // weekday Pn...Nd) and offers only towarzystwo, so demencja is missing too: her card cannot be a full match.
    () => request("/opiekunowie?gmina=1465011&usluga=towarzystwo&usluga=demencja&termin=czw-noc&termin=pon-noc"),
    {
      status: 200,
      html: (text) => {
        const card = cardFragment(text, "Anna Smoke");
        return (
          card !== "" &&
          card.includes("Brakuje terminów: Pn, Cz: noc") &&
          card.includes("Brakuje usług: Opieka nad osobą z demencją") &&
          !card.includes("Pełne dopasowanie")
        );
      },
    },
  ],
  [
    "caregiver list ignores malformed availability",
    () => request("/opiekunowie?gmina=1465011&termin=xyz"),
    { status: 200, html: (text) => text.includes("Anna Smoke") && text.includes("Bartek Smoke") },
  ],
  [
    "caregiver list shows relax hints when nothing matches",
    // Nowinka (2001052) has no smoke profiles: only another gmina helps.
    () => request("/opiekunowie?gmina=2001052&usluga=towarzystwo"),
    {
      status: 200,
      html: (text) =>
        text.includes("Usuń filtr usług (wyniki: 0)") &&
        text.includes("Usuń filtr gminy (wyniki:") &&
        text.includes("Spróbuj sąsiedniej gminy"),
    },
  ],
  [
    "caregiver list ignores malformed filters",
    () => request("/opiekunowie?gmina=abc&usluga=nieznana&strona=-1"),
    { status: 200 },
  ],
  [
    "caregiver list reports unknown gmina",
    () => request("/opiekunowie?gmina=9999991"),
    { status: 200, html: (text) => text.includes("nie istnieje lub została wycofana") },
  ],
  [
    "caregiver list reports page out of range",
    () => request("/opiekunowie?gmina=1465011&strona=999"),
    { status: 200, html: (text) => text.includes("Nie ma takiej strony wyników") },
  ],
  [
    "list links to profile page",
    () => request("/opiekunowie?gmina=1465011"),
    { status: 200, html: (text) => text.includes(`href="/opiekunowie/${caregiverId}"`) },
  ],
  // The single public profile page, as anonymous user: no contact data in the HTML, incomplete profiles are 404.
  [
    "public profile page hides contact",
    () => request(`/opiekunowie/${caregiverId}`),
    {
      status: 200,
      headers: hasNoindex,
      html: (text) =>
        text.includes("Anna Smoke") && text.includes(`href="/kontakt/${caregiverId}"`) && hidesProfileContact(text),
    },
  ],
  [
    "public profile page shows availability",
    () => request(`/opiekunowie/${caregiverId}`),
    {
      status: 200,
      // ">dostępny<": the whole sr-only text of an available cell ("dostępny" alone would also match "niedostępny").
      html: (text) => text.includes(">Dostępność<") && text.includes(">dostępny<") && hidesProfileContact(text),
    },
  ],
  [
    "public profile page 404 for incomplete profile",
    () => request(`/opiekunowie/${incompleteCaregiverId}`),
    { status: 404 },
  ],
  ["public profile page 404 for malformed id", () => request("/opiekunowie/nie-uuid"), { status: 404 }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["profile API requires a session", () => request("/api/caregiver/profile"), { status: 401 }],
  ["profile delete requires a session", () => request("/api/caregiver/profile", { method: "DELETE" }), { status: 401 }],
  ["profile page redirects anonymous user", () => request("/profil"), { status: 302, location: "/auth/signin" }],
  [
    "contact page redirects anonymous user",
    () => request(`/kontakt/${caregiverId}`),
    // exact: the redirect carries the page the anonymous user came from.
    { status: 302, location: () => `/auth/signin?next=%2Fkontakt%2F${caregiverId}`, exact: true },
  ],
  [
    "signup sends coordinator home",
    () =>
      request("/api/auth/signup", { method: "POST", form: { email: coordinatorEmail, password, role: "coordinator" } }),
    // exact: every redirect starts with "/", including the sign-up error page.
    { status: 302, location: "/", exact: true },
  ],
  [
    "profile page sends coordinator home",
    () => request("/profil"),
    // exact: "/auth/signin" would also start with "/".
    { status: 302, location: "/", exact: true },
  ],
  [
    "coordinator cannot save caregiver profile",
    () => request("/api/caregiver/profile", { method: "PUT", json: completeProfile }),
    { status: 403 },
  ],
  [
    "profile delete requires a caregiver",
    () => request("/api/caregiver/profile", { method: "DELETE" }),
    { status: 403 },
  ],
  // RLS, straight against Supabase as the signed-in coordinator.
  [
    "coordinator gets Supabase access token",
    async () => {
      const result = await supabase("/auth/v1/token?grant_type=password", {
        method: "POST",
        json: { email: coordinatorEmail, password },
      });
      coordinatorToken = result.json?.access_token ?? "";
      coordinatorId = result.json?.user?.id ?? "";
      return result;
    },
    { status: 200, body: (json) => typeof json.access_token === "string" && typeof json.user?.id === "string" },
  ],
  [
    "coordinator reads complete caregiver contact",
    () => supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${caregiverId}`, { token: coordinatorToken }),
    {
      status: 200,
      body: (json) => hasOneRow(json) && json[0].phone === "+48600100200" && json[0].email === contactEmail,
    },
  ],
  [
    "coordinator cannot read incomplete caregiver contact",
    () => supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${incompleteCaregiverId}`, { token: coordinatorToken }),
    { status: 200, body: isEmptyArray },
  ],
  [
    "coordinator cannot create caregiver profile",
    () =>
      supabase("/rest/v1/caregiver_profiles", {
        method: "POST",
        token: coordinatorToken,
        json: { user_id: coordinatorId, display_name: "Koordynator Smoke" },
      }),
    { status: 403 },
  ],
  // Profile deletion, straight against Supabase, on a separate fourth caregiver ("Dorota Smoke"), so the profiles
  // used by other steps stay. Here and not next to the availability steps: coordinatorToken is known only from here.
  [
    "fourth caregiver gets Supabase access token",
    async () => {
      const result = await supabase("/auth/v1/signup", {
        method: "POST",
        json: { email: deletableCaregiverEmail, password, data: { role: "caregiver" } },
      });
      deletableCaregiverToken = result.json?.access_token ?? "";
      deletableCaregiverId = result.json?.user?.id ?? "";
      return result;
    },
    { status: 200, body: (json) => typeof json.access_token === "string" && typeof json.user?.id === "string" },
  ],
  [
    "fourth caregiver saves complete profile",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: deletableCaregiverToken,
        json: {
          p_display_name: "Dorota Smoke",
          p_description: null,
          p_phone: "+48600100400",
          p_email: `kontakt4-${stamp}@example.com`,
          p_gminas: ["1465011"],
          p_services: ["towarzystwo"],
          p_availability: ["pon-rano"],
        },
      }),
    { status: 204 },
  ],
  [
    "deletable profile is listed",
    () => searchCaregivers({ p_teryt: "1465011", p_limit: 50 }),
    {
      status: 200,
      // With its availability, so the cascade step below proves that rows existed and are gone.
      body: (json) =>
        Array.isArray(json) &&
        sameSlots(json.find((row) => row.user_id === deletableCaregiverId)?.availability, ["pon-rano"]),
    },
  ],
  [
    "anon cannot delete a caregiver profile",
    () => supabase(`/rest/v1/caregiver_profiles?user_id=eq.${deletableCaregiverId}`, { method: "DELETE" }),
    { status: 401, body: deniesTable("caregiver_profiles") },
  ],
  [
    "other caregiver cannot delete a profile",
    // RLS: someone else's row is not visible to the delete policy, so PostgREST deletes 0 rows instead of failing.
    async () => {
      const deleted = await supabase(`/rest/v1/caregiver_profiles?user_id=eq.${deletableCaregiverId}`, {
        method: "DELETE",
        token: secondCaregiverToken,
        prefer: "return=representation",
      });
      const kept = await getPublicCaregiver(deletableCaregiverId);
      const ok = deleted.status === 200 && isEmptyArray(deleted.json) && kept.status === 200 && hasOneRow(kept.json);
      return { ...deleted, json: { ok, deleted: deleted.json, kept: kept.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "coordinator cannot delete a profile",
    async () => {
      const deleted = await supabase(`/rest/v1/caregiver_profiles?user_id=eq.${deletableCaregiverId}`, {
        method: "DELETE",
        token: coordinatorToken,
        prefer: "return=representation",
      });
      const kept = await getPublicCaregiver(deletableCaregiverId);
      const ok = deleted.status === 200 && isEmptyArray(deleted.json) && kept.status === 200 && hasOneRow(kept.json);
      return { ...deleted, json: { ok, deleted: deleted.json, kept: kept.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "caregiver deletes own profile",
    () =>
      supabase(`/rest/v1/caregiver_profiles?user_id=eq.${deletableCaregiverId}`, {
        method: "DELETE",
        token: deletableCaregiverToken,
        prefer: "return=representation",
      }),
    { status: 200, body: (json) => hasOneRow(json) && json[0].user_id === deletableCaregiverId },
  ],
  [
    "deleted profile leaves no data",
    // The contact is read with the owner's token (anon has no privilege on it); the public lists and the profile as anon.
    async () => {
      const contact = await supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${deletableCaregiverId}`, {
        token: deletableCaregiverToken,
      });
      const publicRows = await Promise.all([
        supabase(`/rest/v1/caregiver_gminas?caregiver_id=eq.${deletableCaregiverId}`),
        supabase(`/rest/v1/caregiver_services?caregiver_id=eq.${deletableCaregiverId}`),
        supabase(`/rest/v1/caregiver_availability?caregiver_id=eq.${deletableCaregiverId}`),
        supabase(`/rest/v1/caregiver_profiles?user_id=eq.${deletableCaregiverId}`),
      ]);
      const all = [contact, ...publicRows];
      const ok = all.every((result) => result.status === 200 && isEmptyArray(result.json));
      return {
        ...contact,
        json: { ok, results: all.map((result) => ({ status: result.status, json: result.json })) },
      };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  [
    "deleted profile is gone from search",
    async () => {
      const listed = await searchCaregivers({ p_teryt: "1465011", p_limit: 50 });
      const single = await getPublicCaregiver(deletableCaregiverId);
      const ok =
        listed.status === 200 &&
        Array.isArray(listed.json) &&
        !listed.json.some((row) => row.user_id === deletableCaregiverId) &&
        single.status === 200 &&
        isEmptyArray(single.json);
      return { ...listed, json: { ok, listed: listed.json, single: single.json } };
    },
    { status: 200, body: (json) => json.ok === true },
  ],
  // The contact page with a session. The cookie jar holds one session at a time: the coordinator (from "signup sends
  // coordinator home"), then the first caregiver again, then a second, new coordinator.
  [
    "contact page shows contact to coordinator",
    () => request(`/kontakt/${caregiverId}`),
    {
      status: 200,
      headers: hasNoindex,
      html: (text) => text.includes("tel:+48600100200") && text.includes(contactEmail),
    },
  ],
  ["contact page 404 for incomplete profile", () => request(`/kontakt/${incompleteCaregiverId}`), { status: 404 }],
  [
    "signin caregiver again",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/profil", exact: true },
  ],
  [
    "contact page hides contact from caregiver",
    () => request(`/kontakt/${secondCaregiverId}`),
    {
      status: 200,
      html: (text) =>
        text.includes("Bartek Smoke") &&
        text.includes("widzą tylko konta koordynatorów") &&
        !text.includes("+48600100300") &&
        !text.includes("600 100 300"),
    },
  ],
  [
    "new coordinator returns to contact after signup",
    () =>
      request("/api/auth/signup", {
        method: "POST",
        form: { email: secondCoordinatorEmail, password, role: "coordinator", next: `/kontakt/${caregiverId}` },
      }),
    { status: 302, location: () => `/kontakt/${caregiverId}`, exact: true },
  ],
  [
    "new coordinator sees contact after signup",
    () => request(`/kontakt/${caregiverId}`),
    { status: 200, html: (text) => text.includes("tel:+48600100200") },
  ],
  // Profile deletion through the app, on a fifth caregiver ("Ewa Smoke") signed up here: the cookie jar now holds its session.
  [
    "fifth caregiver signs up",
    () =>
      request("/api/auth/signup", {
        method: "POST",
        form: { email: appDeletableCaregiverEmail, password, role: "caregiver" },
      }),
    { status: 302, location: "/profil/edycja" },
  ],
  [
    "caregiver saves profile to delete",
    async () => {
      const result = await request("/api/caregiver/profile", {
        method: "PUT",
        json: {
          ...completeProfile,
          displayName: "Ewa Smoke",
          phone: "600 100 500",
          email: `kontakt5-${stamp}@example.com`,
          gminas: ["1465011"],
        },
      });
      appDeletableCaregiverId = result.json?.profile?.id ?? "";
      return result;
    },
    {
      status: 200,
      body: (json) =>
        typeof json.profile?.id === "string" &&
        json.profile.displayName === "Ewa Smoke" &&
        isEmptyArray(json.profile.missing),
    },
  ],
  [
    "profile page offers deletion",
    () => request("/profil"),
    { status: 200, html: (text) => text.includes("Usuń profil") },
  ],
  [
    "caregiver deletes profile via API",
    () => request("/api/caregiver/profile", { method: "DELETE" }),
    { status: 200, body: (json) => json.deleted === true },
  ],
  ["second delete finds no profile", () => request("/api/caregiver/profile", { method: "DELETE" }), { status: 404 }],
  [
    "profile page confirms deletion",
    () => request("/profil?usunieto=1"),
    {
      status: 200,
      html: (text) =>
        text.includes("Profil został usunięty") && text.includes("Utwórz profil") && !text.includes("Usuń profil"),
    },
  ],
  ["deleted profile page is 404", () => request(`/opiekunowie/${appDeletableCaregiverId}`), { status: 404 }],
  [
    "deleted profile is not on the list",
    // By id, not by name: the local database keeps the profiles of every run, so an "Ewa Smoke" left behind by an
    // interrupted run would break this step until db reset.
    () => request("/opiekunowie?gmina=1465011"),
    { status: 200, html: (text) => !text.includes(`/opiekunowie/${appDeletableCaregiverId}`) },
  ],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  // A thrown step (server down, rejected fetch, malformed JSON) is a FAIL with its name, not the end of the run.
  try {
    const actual = await run();
    // location may be a function: ids learned by earlier steps are not known when the steps array is built.
    const expectedLocation = typeof expected.location === "function" ? expected.location() : expected.location;
    const ok =
      actual.status === expected.status &&
      (expectedLocation === undefined ||
        (expected.exact ? actual.location === expectedLocation : actual.location.startsWith(expectedLocation))) &&
      (expected.locationIncludes === undefined || actual.location.includes(expected.locationIncludes)) &&
      (expected.body === undefined || (actual.json !== undefined && expected.body(actual.json))) &&
      (expected.html === undefined || expected.html(actual.text)) &&
      (expected.headers === undefined || expected.headers(actual.headers));
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
    if (!ok) {
      failed++;
      console.log(
        `      expected ${expected.status} ${expectedLocation ?? ""}${expected.locationIncludes ? ` + includes ${expected.locationIncludes}` : ""}${expected.body ? " + body check" : ""}` +
          `${expected.html ? " + html check" : ""}${expected.headers ? " + headers check" : ""}`,
      );
      if (expected.body) console.log(`      body ${JSON.stringify(actual.json)?.slice(0, 300)}`);
      if (expected.html) console.log(`      html ${actual.text.slice(0, 300)}`);
      if (expected.headers) console.log(`      x-robots-tag ${actual.headers.get("x-robots-tag")}`);
    }
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}  -> error ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
