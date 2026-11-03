declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    // Role of the signed-in user, read once per request (null without a session, Supabase config or accounts row).
    getRole: () => Promise<import("@/types").AccountRole | null>;
  }
}
