// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, the public dictionaries
// and the caregiver profile API and pages still work together, that RLS keeps contact data away from anon and coordinators,
// and that the public caregiver list (search_caregivers) hides incomplete profiles, filters hard and exposes no contact data.
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
// Contact e-mail of the first caregiver: differs from the login e-mail, so absence checks look for the real value.
const contactEmail = `kontakt-${stamp}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();
// Filled in by earlier steps, used by later ones.
let caregiverId = "";
let coordinatorId = "";
let coordinatorToken = "";
let secondCaregiverToken = "";

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
async function supabase(path, { method = "GET", token, json } = {}) {
  const response = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_KEY}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  return readResponse(response);
}

const isEmptyArray = (json) => Array.isArray(json) && json.length === 0;
const hasOneRow = (json) => Array.isArray(json) && json.length === 1;

// Public caregiver list straight from the database, as anon (no token) unless one is given.
const searchCaregivers = (args) => supabase("/rest/v1/rpc/search_caregivers", { method: "POST", json: args });
const listsCaregiver = (json) => Array.isArray(json) && json.some((row) => row.user_id === caregiverId);
const hidesCaregiver = (json) => Array.isArray(json) && !json.some((row) => row.user_id === caregiverId);
const CONTACT_KEYS = ["phone", "email", "caregiver_contacts"];
const hasNoindex = (headers) => (headers.get("x-robots-tag") ?? "").includes("noindex");

// The 13 catalogue slugs (also checked by "services dictionary lists 13 services"), filled by that step.
let allServiceSlugs = [];

const completeProfile = {
  displayName: "Anna Smoke",
  description: "",
  phone: "600 100 200",
  email: contactEmail,
  gminas: ["1465011"],
  services: ["towarzystwo"],
};

const steps = [
  // Dictionaries first: they must work for an anonymous user (no session cookie yet).
  [
    "services dictionary lists 13 services",
    async () => {
      const result = await request("/api/dictionaries/services");
      allServiceSlugs = (result.json?.services ?? []).map((service) => service.slug);
      return result;
    },
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
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
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
        isEmptyArray(json.profile.missing),
    },
  ],
  ["profile page renders for caregiver", () => request("/profil"), { status: 200 }],
  // RLS, straight against Supabase as anon: the public part is readable, contact data and roles are not.
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
    { status: 200, body: isEmptyArray },
  ],
  ["anon cannot read account roles", () => supabase("/rest/v1/accounts"), { status: 200, body: isEmptyArray }],
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
    "search requires all selected services",
    () => searchCaregivers({ p_teryt: "1465011", p_services: ["towarzystwo", "demencja"], p_limit: 50 }),
    { status: 200, body: hidesCaregiver },
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
      return result;
    },
    { status: 200, body: (json) => typeof json.access_token === "string" },
  ],
  [
    "second caregiver saves complete profile",
    () =>
      supabase("/rest/v1/rpc/save_caregiver_profile", {
        method: "POST",
        token: secondCaregiverToken,
        json: {
          p_display_name: "Bartek Smoke",
          p_description: null,
          p_phone: "+48600100300",
          p_email: null,
          p_gminas: ["1465011"],
          p_services: ["towarzystwo"],
        },
      }),
    { status: 204 },
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
      html: (text) =>
        text.includes("Anna Smoke") &&
        ["600 100 200", "600100200", "+48600100200", completeProfile.email, email].every(
          (secret) => !text.includes(secret),
        ),
    },
  ],
  [
    "caregiver list shows relax hints when nothing matches",
    () => request(`/opiekunowie?gmina=1465011${allServiceSlugs.map((slug) => `&usluga=${slug}`).join("")}`),
    { status: 200, html: (text) => text.includes("Usuń filtr usług") },
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
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["profile API requires a session", () => request("/api/caregiver/profile"), { status: 401 }],
  ["profile page redirects anonymous user", () => request("/profil"), { status: 302, location: "/auth/signin" }],
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
    "coordinator cannot read caregiver contact",
    () => supabase(`/rest/v1/caregiver_contacts?caregiver_id=eq.${caregiverId}`, { token: coordinatorToken }),
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
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined ||
      (expected.exact ? actual.location === expected.location : actual.location.startsWith(expected.location))) &&
    (expected.body === undefined || (actual.json !== undefined && expected.body(actual.json))) &&
    (expected.html === undefined || expected.html(actual.text)) &&
    (expected.headers === undefined || expected.headers(actual.headers));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(
      `      expected ${expected.status} ${expected.location ?? ""}${expected.body ? " + body check" : ""}` +
        `${expected.html ? " + html check" : ""}${expected.headers ? " + headers check" : ""}`,
    );
    if (expected.body) console.log(`      body ${JSON.stringify(actual.json)?.slice(0, 300)}`);
    if (expected.html) console.log(`      html ${actual.text.slice(0, 300)}`);
    if (expected.headers) console.log(`      x-robots-tag ${actual.headers.get("x-robots-tag")}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
