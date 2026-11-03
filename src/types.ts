// Shared entity/DTO types used by API endpoints and UI.

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

// The caregiver's own profile, including contact data: serve it only to its owner, on protected routes.
// services follow the catalogue sort_order, gminas are sorted by label; active = false marks a retired gmina.
export interface OwnCaregiverProfileDto {
  id: string;
  displayName: string;
  description: string | null;
  contact: { phone: string | null; email: string | null };
  gminas: (GminaDto & { active: boolean })[];
  services: ServiceDto[];
  missing: CaregiverMissingItem[];
}

// Full replacement of the caller's profile. phone is already normalized to +48XXXXXXXXX;
// gminas are TERC codes, services are catalogue slugs.
export interface SaveCaregiverProfileCommand {
  displayName: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  gminas: string[];
  services: string[];
}
