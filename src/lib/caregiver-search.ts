import { z } from "zod";
import { sortAvailability } from "@/lib/availability";
import type { CaregiverSearchFilter } from "@/types";

export const CAREGIVER_LIST_PATH = "/opiekunowie";

// TERC code: 6 digits plus the kind digit (1 miejska, 2 wiejska, 3 miejsko-wiejska).
const terytSchema = z.string().regex(/^[0-9]{6}[123]$/);
// Capped so a huge page number stays within the database int range and ends up as "page out of range".
const MAX_PAGE = 1_000_000;
const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .transform((value) => Math.min(value, MAX_PAGE));

// Reads the list filters from the URL. Malformed values are ignored (never an error), so a hand-edited
// or stale link still renders a list. Services come back de-duplicated and in catalogue order, availability slots
// de-duplicated and in canonical slot order.
export function parseCaregiverSearch(
  params: URLSearchParams,
  knownServiceSlugs: string[],
): { filter: CaregiverSearchFilter; page: number } {
  const teryt = terytSchema.safeParse(params.get("gmina"));
  const requested = new Set(params.getAll("usluga"));
  const pageParam = params.get("strona");
  const page = pageParam === null ? null : pageSchema.safeParse(pageParam);

  return {
    filter: {
      teryt: teryt.success ? teryt.data : null,
      services: knownServiceSlugs.filter((slug) => requested.has(slug)),
      availability: sortAvailability(params.getAll("termin")),
    },
    page: page?.success ? page.data : 1,
  };
}

// Link to the list with the given filters; the parameter order is fixed and `strona` appears only past page 1.
export function buildCaregiverSearchHref(filter: CaregiverSearchFilter, page = 1): string {
  const params = new URLSearchParams();
  if (filter.teryt) {
    params.append("gmina", filter.teryt);
  }
  for (const slug of filter.services) {
    params.append("usluga", slug);
  }
  for (const slot of sortAvailability(filter.availability)) {
    params.append("termin", slot);
  }
  if (page > 1) {
    params.append("strona", String(page));
  }
  const query = params.toString();
  return query ? `${CAREGIVER_LIST_PATH}?${query}` : CAREGIVER_LIST_PATH;
}
