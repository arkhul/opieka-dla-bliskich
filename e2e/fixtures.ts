import { test as base } from "@playwright/test";
import { formatGminaLabel } from "@/lib/gmina";
import { formatPlPhone } from "@/lib/phone";
import type { SaveCaregiverProfileCommand } from "@/types";

// Łódź (1061011): npm run smoke only ever seeds Warszawa (1465011), so this gmina's result list
// never grows across smoke runs and stays deterministic for this flow.
const GMINA_TERYT = "1061011";
const GMINA_LABEL = formatGminaLabel({ name: "Łódź", kind: "miejska", powiat: "Łódź", wojewodztwo: "łódzkie" });

// Exactly one service on the fixture profile: filtering by SERVICE plus MISSING_SERVICE always leaves
// MISSING_SERVICE as the single, deterministic gap on the result card.
const SERVICE = { slug: "towarzystwo", label: "Towarzystwo i rozmowa" };
const MISSING_SERVICE = { slug: "zakupy-i-sprawy", label: "Zakupy i załatwianie spraw" };

export const PASSWORD = "E2e-Test-Passw0rd!";

// Astro's cross-origin form guard (origin-check.js) rejects a form POST without a matching Origin header;
// api/request has no browser behind it to set one, so the fixture supplies it itself.
const ORIGIN = process.env.BASE_URL ?? "http://localhost:4321";

export interface CaregiverFixture {
  id: string;
  displayName: string;
  phone: string;
  phoneDisplay: string;
  contactEmail: string;
  gmina: { teryt: string; label: string };
  service: { slug: string; label: string };
  missingService: { slug: string; label: string };
}

interface SaveProfileResponse {
  profile: { id: string };
}

export const test = base.extend<{ caregiver: CaregiverFixture }>({
  caregiver: async ({ request }, use, testInfo) => {
    const stamp = `${Date.now()}-${testInfo.project.name}`;
    const displayName = `Ewa E2E ${stamp}`;
    const loginEmail = `e2e-caregiver-${stamp}@example.com`;
    const contactEmail = `e2e-kontakt-${stamp}@example.com`;
    const phone = "+48700200300";

    // Same seeding path as scripts/smoke.mjs: register a caregiver account, then PUT its profile.
    const signUp = await request.post("/api/auth/signup", {
      form: { email: loginEmail, password: PASSWORD, role: "caregiver" },
      headers: { origin: ORIGIN },
    });
    if (!signUp.ok()) {
      throw new Error(`Caregiver fixture sign-up failed with status ${signUp.status()}`);
    }

    const command: SaveCaregiverProfileCommand = {
      displayName,
      description: null,
      phone,
      email: contactEmail,
      gminas: [GMINA_TERYT],
      services: [SERVICE.slug],
      availability: [],
    };
    const save = await request.put("/api/caregiver/profile", { data: command });
    if (!save.ok()) {
      throw new Error(`Caregiver fixture profile save failed with status ${save.status()}`);
    }
    const body = (await save.json()) as SaveProfileResponse;

    await use({
      id: body.profile.id,
      displayName,
      phone,
      phoneDisplay: formatPlPhone(phone),
      contactEmail,
      gmina: { teryt: GMINA_TERYT, label: GMINA_LABEL },
      service: SERVICE,
      missingService: MISSING_SERVICE,
    });
  },
});

export { expect } from "@playwright/test";
