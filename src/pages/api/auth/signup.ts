import type { APIRoute } from "astro";
import { z } from "zod";
import { toPolishAuthError } from "@/lib/auth-errors";
import { safeNextPath, withNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase";

const signUpSchema = z.object({
  email: z.email({ error: "Podaj poprawny adres e-mail." }),
  password: z.string({ error: "Podaj hasło." }).min(6, { error: "Hasło musi mieć co najmniej 6 znaków." }),
  role: z.enum(["caregiver", "coordinator"], { error: "Wybierz, czy oferujesz opiekę, czy jej szukasz." }),
  // A bad return address is not a sign-up error: it is dropped (null).
  next: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => safeNextPath(value)),
});

function signUpError(message: string, next: string | null) {
  return withNext(`/auth/signup?error=${encodeURIComponent(message)}`, next);
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signUpSchema.safeParse({
    email: (form.get("email") as string | null)?.trim() ?? undefined,
    password: form.get("password") ?? undefined,
    role: form.get("role") ?? undefined,
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) {
    // Validation failed, so there is no parsed `next`: read it again through the same helper to keep it on the form.
    return context.redirect(
      signUpError(parsed.error.issues[0]?.message ?? "Niepoprawne dane rejestracji.", safeNextPath(form.get("next"))),
    );
  }
  const { email, password, role, next } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(signUpError("Supabase nie jest skonfigurowany.", next));
  }

  // handle_new_user() copies the role from user metadata into public.accounts and rejects sign-ups without one.
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { role } } });

  if (error) {
    return context.redirect(signUpError(toPolishAuthError(error.message), next));
  }

  // A new caregiver always starts with onboarding, so `next` only applies to coordinators.
  const returnTo = role === "coordinator" ? next : null;

  // No session means email confirmation is enabled: the user must click the link first.
  if (!data.session) {
    return context.redirect(withNext("/auth/confirm-email", returnTo));
  }

  if (role === "caregiver") {
    return context.redirect("/profil/edycja");
  }
  return context.redirect(returnTo ?? "/");
};
