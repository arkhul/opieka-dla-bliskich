// Maps Supabase Auth error messages (English, matched loosely) to Polish texts shown to the user.
const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, "Nieprawidłowy e-mail lub hasło."],
  [/already (been )?registered|already exists/i, "Konto z tym adresem e-mail już istnieje. Zaloguj się."],
  [
    /password should be at least|password.*(too short|at least \d+ characters)/i,
    "Hasło musi mieć co najmniej 6 znaków.",
  ],
  [/weak password|password is known to be weak|password should contain/i, "Hasło jest zbyt słabe. Wybierz inne."],
  [/email not confirmed/i, "Adres e-mail nie został potwierdzony. Kliknij link wysłany na Twoją skrzynkę."],
  [/invalid format|valid email|email address .* is invalid/i, "Podaj poprawny adres e-mail."],
  [/rate limit|too many requests|for security purposes/i, "Zbyt wiele prób. Spróbuj ponownie za chwilę."],
  [/signups? not allowed|signup is disabled/i, "Rejestracja jest obecnie wyłączona."],
  // handle_new_user() rejects a sign-up without a valid role; GoTrue reports it as a database error.
  [/database error saving new user/i, "Nie udało się utworzyć konta. Sprawdź, czy wybrano rolę, i spróbuj ponownie."],
];

const GENERIC_AUTH_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

export function toPolishAuthError(message: string): string {
  for (const [pattern, polish] of AUTH_ERRORS) {
    if (pattern.test(message)) return polish;
  }
  return GENERIC_AUTH_ERROR;
}
