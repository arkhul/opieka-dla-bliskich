import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import { formatGminaLabel } from "@/lib/gmina";
import type {
  CaregiverMissingItem,
  GminaKind,
  OwnCaregiverProfileDto,
  SaveCaregiverProfileCommand,
  ServiceDto,
} from "@/types";

// Raised for errcode 22023 from save_caregiver_profile(): the message is Polish and meant for the user.
export class CaregiverProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaregiverProfileValidationError";
  }
}

interface ContactRow {
  phone: string | null;
  email: string | null;
}

interface GminaRow {
  teryt: string;
  name: string;
  kind: GminaKind;
  powiat: string;
  wojewodztwo: string;
  active: boolean;
}

interface ServiceRow {
  slug: string;
  label: string;
  sort_order: number;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  description: string | null;
  // caregiver_contacts is keyed by caregiver_id, so PostgREST embeds it as a one-to-one object;
  // the array form is accepted too, in case relationship detection ever differs.
  caregiver_contacts: ContactRow | ContactRow[] | null;
  caregiver_gminas: { gminas: GminaRow | null }[];
  caregiver_services: { services: ServiceRow | null }[];
}

const OWN_PROFILE_SELECT = [
  "user_id",
  "display_name",
  "description",
  "caregiver_contacts(phone, email)",
  "caregiver_gminas(gminas(teryt, name, kind, powiat, wojewodztwo, active))",
  "caregiver_services(services(slug, label, sort_order))",
].join(", ");

// Completeness rule lives in SQL; without generated DB types the rpc result is untyped (it returns text[]).
async function getMissingItems(supabase: SupabaseClient, userId: string): Promise<CaregiverMissingItem[]> {
  const { data, error } = (await supabase.rpc("caregiver_profile_missing", {
    p_caregiver_id: userId,
  })) as PostgrestSingleResponse<CaregiverMissingItem[]>;

  if (error) {
    throw new Error(`Failed to check caregiver profile completeness: ${error.message}`);
  }

  return data;
}

async function getProfileRow(supabase: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("caregiver_profiles")
    .select(OWN_PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<ProfileRow | null, { merge: false }>();

  if (error) {
    throw new Error(`Failed to read caregiver profile: ${error.message}`);
  }

  return data;
}

// RLS returns contact data only to its owner, so for anyone else's id the contact comes back empty.
export async function getOwnProfile(supabase: SupabaseClient, userId: string): Promise<OwnCaregiverProfileDto | null> {
  const [row, missing] = await Promise.all([getProfileRow(supabase, userId), getMissingItems(supabase, userId)]);
  if (!row) {
    return null;
  }

  const contact = Array.isArray(row.caregiver_contacts) ? (row.caregiver_contacts[0] ?? null) : row.caregiver_contacts;

  const gminas = row.caregiver_gminas
    .flatMap(({ gminas: g }) => (g ? [g] : []))
    .map(({ teryt, name, kind, powiat, wojewodztwo, active }) => ({
      teryt,
      name,
      kind,
      powiat,
      wojewodztwo,
      active,
      label: formatGminaLabel({ name, kind, powiat, wojewodztwo }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pl"));

  const services: ServiceDto[] = row.caregiver_services
    .flatMap(({ services: s }) => (s ? [s] : []))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ slug, label }) => ({ slug, label }));

  return {
    id: row.user_id,
    displayName: row.display_name,
    description: row.description,
    contact: { phone: contact?.phone ?? null, email: contact?.email ?? null },
    gminas,
    services,
    missing,
  };
}

// Saves the caller's (auth.uid()) whole profile atomically; the database re-validates gminas and services.
export async function saveOwnProfile(supabase: SupabaseClient, cmd: SaveCaregiverProfileCommand): Promise<void> {
  const { error } = await supabase.rpc("save_caregiver_profile", {
    p_display_name: cmd.displayName,
    p_description: cmd.description,
    p_phone: cmd.phone,
    p_email: cmd.email,
    p_gminas: cmd.gminas,
    p_services: cmd.services,
  });

  if (error) {
    if (error.code === "22023") {
      throw new CaregiverProfileValidationError(error.message);
    }
    throw new Error(`Failed to save caregiver profile: ${error.message}`);
  }
}
