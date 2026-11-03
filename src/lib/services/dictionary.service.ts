import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import { formatGminaLabel } from "@/lib/gmina";
import type { GminaDto, GminaKind, ServiceDto } from "@/types";

interface ServiceRow {
  slug: string;
  label: string;
}

interface GminaRow {
  teryt: string;
  name: string;
  kind: GminaKind;
  powiat: string;
  wojewodztwo: string;
}

export async function listServices(supabase: SupabaseClient): Promise<ServiceDto[]> {
  const { data, error } = await supabase
    .from("services")
    .select("slug, label")
    .order("sort_order", { ascending: true })
    .overrideTypes<ServiceRow[], { merge: false }>();

  if (error) {
    throw new Error(`Failed to list services: ${error.message}`);
  }

  return data.map(({ slug, label }) => ({ slug, label }));
}

export async function searchGminas(supabase: SupabaseClient, query: string, limit: number): Promise<GminaDto[]> {
  // Without generated DB types the rpc result is untyped; search_gminas returns setof public.gminas.
  const { data, error } = (await supabase.rpc("search_gminas", {
    q: query,
    max_results: limit,
  })) as PostgrestSingleResponse<GminaRow[]>;

  if (error) {
    throw new Error(`Failed to search gminas: ${error.message}`);
  }

  // Keep the order returned by SQL (prefix matches first); drop search_name and any other extra columns.
  return data.map(({ teryt, name, kind, powiat, wojewodztwo }) => ({
    teryt,
    name,
    kind,
    powiat,
    wojewodztwo,
    label: formatGminaLabel({ name, kind, powiat, wojewodztwo }),
  }));
}

// One active gmina by TERC code, or null when it does not exist or has been retired.
export async function getActiveGmina(supabase: SupabaseClient, teryt: string): Promise<GminaDto | null> {
  const { data, error } = await supabase
    .from("gminas")
    .select("teryt, name, kind, powiat, wojewodztwo")
    .eq("teryt", teryt)
    .eq("active", true)
    .maybeSingle()
    .overrideTypes<GminaRow | null, { merge: false }>();

  if (error) {
    throw new Error(`Failed to read gmina: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { name, kind, powiat, wojewodztwo } = data;
  return {
    teryt: data.teryt,
    name,
    kind,
    powiat,
    wojewodztwo,
    label: formatGminaLabel({ name, kind, powiat, wojewodztwo }),
  };
}
