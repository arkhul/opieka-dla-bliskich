import type { APIRoute } from "astro";
import { toPolishAuthError } from "@/lib/auth-errors";
import { getAccountRole } from "@/lib/services/account.service";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase nie jest skonfigurowany.")}`);
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(toPolishAuthError(error.message))}`);
  }

  // The session is valid even if the role cannot be read; fall back to the home page then.
  const role = await getAccountRole(supabase, data.user.id).catch(() => null);

  return context.redirect(role === "caregiver" ? "/profil" : "/");
};
