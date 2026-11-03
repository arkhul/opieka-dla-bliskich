import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole } from "@/types";

interface AccountRow {
  role: AccountRole;
}

// RLS lets a user read only their own accounts row, so this returns null for anyone else's id.
// No row (e.g. an account created before roles existed) also means "no role".
export async function getAccountRole(supabase: SupabaseClient, userId: string): Promise<AccountRole | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<AccountRow | null, { merge: false }>();

  if (error) {
    throw new Error(`Failed to read account role: ${error.message}`);
  }

  return data?.role ?? null;
}
