// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, the public dictionaries
// and the caregiver profile API still work together, and that RLS keeps contact data away from anon and coordinators.
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
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();
// Filled in by earlier steps, used by later ones.
let caregiverId = "";
let coordinatorId = "";
let coordinatorToken = "";

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
    json: isJson ? await response.json() : undefined,
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

const completeProfile = {
  displayName: "Anna Smoke",
  description: "",
  phone: "600 100 200",
  email: "",
  gminas: ["1465011"],
  services: ["towarzystwo"],
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
  ["home renders", () => request("/"), { status: 200 }],
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
    { status: 302, location: "/profil" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
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
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["profile API requires a session", () => request("/api/caregiver/profile"), { status: 401 }],
  [
    "signup sends coordinator home",
    () =>
      request("/api/auth/signup", { method: "POST", form: { email: coordinatorEmail, password, role: "coordinator" } }),
    // exact: every redirect starts with "/", including the sign-up error page.
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
    (expected.body === undefined || (actual.json !== undefined && expected.body(actual.json)));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}${expected.body ? " + body check" : ""}`);
    if (expected.body) console.log(`      body ${JSON.stringify(actual.json)?.slice(0, 300)}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
