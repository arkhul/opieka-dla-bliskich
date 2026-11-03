import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import { formatGminaLabel } from "@/lib/gmina";
import type {
  CaregiverContactDto,
  CaregiverMissingItem,
  CaregiverSearchFilter,
  GminaKind,
  OwnCaregiverProfileDto,
  PublicCaregiverDto,
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

export const CAREGIVER_PAGE_SIZE = 20;

// Row of search_caregivers() and get_public_caregiver(): public columns only. services/gminas are jsonb arrays built in SQL.
interface PublicRow {
  user_id: string;
  display_name: string;
  description: string | null;
  services: ServiceDto[];
  gminas: Omit<GminaRow, "active">[];
}

interface SearchRow extends PublicRow {
  total_count: number | string;
}

function toPublicCaregiver(row: PublicRow): PublicCaregiverDto {
  return {
    id: row.user_id,
    displayName: row.display_name,
    description: row.description,
    services: row.services.map(({ slug, label }) => ({ slug, label })),
    gminas: row.gminas.map(({ teryt, name, kind, powiat, wojewodztwo }) => ({
      teryt,
      name,
      kind,
      powiat,
      wojewodztwo,
      label: formatGminaLabel({ name, kind, powiat, wojewodztwo }),
    })),
  };
}

async function runSearch(supabase: SupabaseClient, filter: CaregiverSearchFilter, limit: number, offset: number) {
  // Without generated DB types the rpc result is untyped; the filter semantics live in SQL.
  const { data, error } = (await supabase.rpc("search_caregivers", {
    p_teryt: filter.teryt,
    p_services: filter.services,
    p_limit: limit,
    p_offset: offset,
  })) as PostgrestSingleResponse<SearchRow[]>;

  if (error) {
    throw new Error(`Failed to search caregivers: ${error.message}`);
  }

  return data;
}

// Number of complete profiles matching the filter (the same RPC as the list, one row).
export async function countCaregivers(supabase: SupabaseClient, filter: CaregiverSearchFilter): Promise<number> {
  const rows = await runSearch(supabase, filter, 1, 0);
  return rows.length > 0 ? Number(rows[0].total_count) : 0;
}

// One page of the public caregiver list. No rows on page 1 means no matches; no rows on a later page
// means the page is out of range, so the real total is counted for the caller to tell the two apart.
export async function searchCaregivers(
  supabase: SupabaseClient,
  filter: CaregiverSearchFilter,
  page: number,
): Promise<{ caregivers: PublicCaregiverDto[]; total: number }> {
  const rows = await runSearch(supabase, filter, CAREGIVER_PAGE_SIZE, (page - 1) * CAREGIVER_PAGE_SIZE);

  if (rows.length === 0) {
    return { caregivers: [], total: page > 1 ? await countCaregivers(supabase, filter) : 0 };
  }

  return { caregivers: rows.map(toPublicCaregiver), total: Number(rows[0].total_count) };
}

// One public profile (the same visibility rule as the list), or null when it does not exist or is incomplete.
export async function getPublicCaregiver(supabase: SupabaseClient, id: string): Promise<PublicCaregiverDto | null> {
  const { data, error } = (await supabase.rpc("get_public_caregiver", {
    p_caregiver_id: id,
  })) as PostgrestSingleResponse<PublicRow[]>;

  if (error) {
    throw new Error(`Failed to read public caregiver: ${error.message}`);
  }

  return data.length > 0 ? toPublicCaregiver(data[0]) : null;
}

// Contact data of one caregiver: serve it only on protected routes. RLS decides who gets it (the owner, and
// coordinators for a complete profile); null means nothing came back, whatever the reason.
export async function getCaregiverContact(supabase: SupabaseClient, id: string): Promise<CaregiverContactDto | null> {
  const { data, error } = await supabase
    .from("caregiver_contacts")
    .select("phone, email")
    .eq("caregiver_id", id)
    .maybeSingle()
    .overrideTypes<ContactRow | null, { merge: false }>();

  if (error) {
    throw new Error(`Failed to read caregiver contact: ${error.message}`);
  }

  return data ? { phone: data.phone, email: data.email } : null;
}
