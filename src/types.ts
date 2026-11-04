// Shared entity/DTO types used by API endpoints and UI.

import type { AvailabilitySlot } from "@/lib/availability";

export type GminaKind = "miejska" | "wiejska" | "miejsko-wiejska";

export interface ServiceDto {
  slug: string;
  label: string;
}

export interface GminaDto {
  teryt: string;
  name: string;
  kind: GminaKind;
  powiat: string;
  wojewodztwo: string;
  label: string;
}

export type AccountRole = "caregiver" | "coordinator";

// Items the completeness rule (caregiver_profile_missing in SQL) can report, in its fixed order.
export type CaregiverMissingItem = "display_name" | "phone" | "gminas" | "services";

// A caregiver's contact data: serve it only on protected routes (to its owner, or to coordinators for a complete
// profile), never on public pages or in public API responses.
export interface CaregiverContactDto {
  phone: string | null;
  email: string | null;
}

// The caregiver's own profile, including contact data: serve it only to its owner, on protected routes.
// services follow the catalogue sort_order, gminas are sorted by label; active = false marks a retired gmina.
// availability is in canonical slot order (src/lib/availability.ts).
export interface OwnCaregiverProfileDto {
  id: string;
  displayName: string;
  description: string | null;
  contact: CaregiverContactDto;
  gminas: (GminaDto & { active: boolean })[];
  services: ServiceDto[];
  availability: AvailabilitySlot[];
  missing: CaregiverMissingItem[];
}

// Full replacement of the caller's profile. phone is already normalized to +48XXXXXXXXX;
// gminas are TERC codes, services are catalogue slugs, availability is deduplicated and in canonical slot order.
export interface SaveCaregiverProfileCommand {
  displayName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  gminas: string[];
  services: string[];
  availability: AvailabilitySlot[];
}

// A caregiver as shown on public pages (the search list). It has no contact fields and must never get any:
// phone, e-mail and address are served only on protected routes.
// services follow the catalogue sort_order; gminas are the active ones, sorted by name; availability is public
// and in canonical slot order.
export interface PublicCaregiverDto {
  id: string;
  displayName: string;
  description: string | null;
  services: ServiceDto[];
  gminas: GminaDto[];
  availability: AvailabilitySlot[];
}

// How a listed caregiver matches the selected filters: the selected services it does not offer (catalogue
// sort_order) and the selected slots it does not have (canonical slot order). Both empty = full match, and both
// are always empty when nothing is selected. Public data, like the rest of the card.
export interface CaregiverMatchDto {
  missingServices: ServiceDto[];
  missingAvailability: AvailabilitySlot[];
}

// A caregiver on the public search list: the public profile plus how it matches the filters.
export interface RankedCaregiverDto extends PublicCaregiverDto {
  match: CaregiverMatchDto;
}

// Empty-result hint counts: matches without the service filter and without the gmina filter.
// null = that filter was not selected, so there is nothing to remove.
export interface RelaxedCaregiverCounts {
  withoutServices: number | null;
  withoutGmina: number | null;
}

// Filters of the public caregiver list. The gmina (TERC) is a hard filter. With selected services a profile must
// offer at least one of them, and profiles offering more of them rank higher. Availability slots never hide a
// profile, they only set the order within the same service coverage (empty = no slots selected; canonical order).
export interface CaregiverSearchFilter {
  teryt: string | null;
  services: string[];
  availability: AvailabilitySlot[];
}
