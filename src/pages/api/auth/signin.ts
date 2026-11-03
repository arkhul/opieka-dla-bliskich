import type { APIRoute } from "astro";
import { toPolishAuthError } from "@/lib/auth-errors";
import { safeNextPath, withNext } from "@/lib/redirect";
import { getAccountRole } from "@/lib/services/account.service";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  const next = safeNextPath(form.get("next"));

  const signInError = (message: string) =>
    context.redirect(withNext(`/auth/signin?error=${encodeURIComponent(message)}`, next));

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return signInError("Supabase nie jest skonfigurowany.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return signInError(toPolishAuthError(error.message));
  }

  // A return address wins for every role; the role (and its default page) is only read when there is none.
  if (next) {
    return context.redirect(next);
  }

  // The session is valid even if the role cannot be read; fall back to the home page then.
  const role = await getAccountRole(supabase, data.user.id).catch(() => null);

  return context.redirect(role === "caregiver" ? "/profil" : "/");
};
