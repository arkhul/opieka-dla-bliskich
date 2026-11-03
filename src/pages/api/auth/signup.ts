import type { APIRoute } from "astro";
import { z } from "zod";
import { toPolishAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase";

const signUpSchema = z.object({
  email: z.email({ error: "Podaj poprawny adres e-mail." }),
  password: z.string({ error: "Podaj hasło." }).min(6, { error: "Hasło musi mieć co najmniej 6 znaków." }),
  role: z.enum(["caregiver", "coordinator"], { error: "Wybierz, czy oferujesz opiekę, czy jej szukasz." }),
});

function signUpError(message: string) {
  return `/auth/signup?error=${encodeURIComponent(message)}`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signUpSchema.safeParse({
    email: (form.get("email") as string | null)?.trim() ?? undefined,
    password: form.get("password") ?? undefined,
    role: form.get("role") ?? undefined,
  });
  if (!parsed.success) {
    return context.redirect(signUpError(parsed.error.issues[0]?.message ?? "Niepoprawne dane rejestracji."));
  }
  const { email, password, role } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(signUpError("Supabase nie jest skonfigurowany."));
  }

  // handle_new_user() copies the role from user metadata into public.accounts and rejects sign-ups without one.
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { role } } });

  if (error) {
    return context.redirect(signUpError(toPolishAuthError(error.message)));
  }

  // No session means email confirmation is enabled: the user must click the link first.
  if (!data.session) {
    return context.redirect("/auth/confirm-email");
  }

  return context.redirect(role === "caregiver" ? "/profil/edycja" : "/");
};
