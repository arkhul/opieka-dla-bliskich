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
