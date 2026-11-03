import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import { normalizePlPhone } from "@/lib/phone";
import { getAccountRole } from "@/lib/services/account.service";
import { CaregiverProfileValidationError, getOwnProfile, saveOwnProfile } from "@/lib/services/caregiver.service";
import { createClient } from "@/lib/supabase";
import type { SaveCaregiverProfileCommand } from "@/types";

// Responses carry the owner's contact data: never cache them in shared caches or keep them on disk.
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function unique(values: string[]) {
  return [...new Set(values)];
}

// Optional text: missing, null or blank after trim -> null.
const optionalText = z
  .string({ error: "Wartość musi być tekstem." })
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
  });

const saveProfileSchema = z.object(
  {
    displayName: z
      .string({ error: "Podaj imię." })
      .trim()
      .min(2, { error: "Imię musi mieć od 2 do 60 znaków." })
      .max(60, { error: "Imię musi mieć od 2 do 60 znaków." }),
    description: optionalText.refine((value) => value === null || value.length <= 1000, {
      error: "Opis może mieć najwyżej 1000 znaków.",
    }),
    phone: optionalText.transform((value, ctx) => {
      if (value === null) {
        return null;
      }
      const normalized = normalizePlPhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Podaj polski numer telefonu (9 cyfr)" });
        return z.NEVER;
      }
      return normalized;
    }),
    email: optionalText.pipe(
      z
        .email({ error: "Podaj poprawny adres e-mail." })
        .max(254, { error: "Adres e-mail może mieć najwyżej 254 znaki." })
        .nullable(),
    ),
    gminas: z
      .array(
        z.string({ error: "Niepoprawny kod gminy." }).regex(/^[0-9]{6}[123]$/, { error: "Niepoprawny kod gminy." }),
        {
          error: "Lista gmin jest niepoprawna.",
        },
      )
      .default([])
      .transform(unique)
      .refine((codes) => codes.length <= 30, { error: "Możesz wybrać najwyżej 30 gmin." }),
    services: z
      .array(z.string({ error: "Niepoprawna usługa." }).min(1, { error: "Niepoprawna usługa." }), {
        error: "Lista usług jest niepoprawna.",
      })
      .default([])
      .transform(unique)
      .refine((slugs) => slugs.length <= 13, { error: "Możesz wybrać najwyżej 13 usług." }),
  },
  { error: "Nieprawidłowe dane profilu." },
);

type GuardResult =
  | { ok: true; supabase: NonNullable<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: Response };

// Order matters: 401 without a session, 503 without Supabase, 403 for anyone but a caregiver.
async function guard(context: APIContext): Promise<GuardResult> {
  const user = context.locals.user;
  if (!user) {
    return { ok: false, response: json({ error: "Musisz być zalogowany." }, 401) };
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return { ok: false, response: json({ error: "Supabase nie jest skonfigurowany." }, 503) };
  }

  const role = await getAccountRole(supabase, user.id);
  if (role !== "caregiver") {
    return { ok: false, response: json({ error: "Profil opiekuna jest dostępny tylko dla opiekunów." }, 403) };
  }

  return { ok: true, supabase, userId: user.id };
}

export const GET: APIRoute = async (context) => {
  try {
    const access = await guard(context);
    if (!access.ok) {
      return access.response;
    }

    const profile = await getOwnProfile(access.supabase, access.userId);
    return json({ profile });
  } catch {
    return json({ error: "Nie udało się wczytać profilu." }, 500);
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const access = await guard(context);
    if (!access.ok) {
      return access.response;
    }

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return json({ error: "Nie udało się odczytać danych formularza.", fieldErrors: {} }, 400);
    }

    const parsed = saveProfileSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      let formError: string | undefined;
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          fieldErrors[field] ??= issue.message;
        } else {
          formError ??= issue.message;
        }
      }
      return json({ error: formError ?? "Popraw zaznaczone pola.", fieldErrors }, 400);
    }

    const command: SaveCaregiverProfileCommand = parsed.data;
    try {
      await saveOwnProfile(access.supabase, command);
    } catch (error) {
      if (error instanceof CaregiverProfileValidationError) {
        return json({ error: error.message }, 400);
      }
      throw error;
    }

    const profile = await getOwnProfile(access.supabase, access.userId);
    return json({ profile });
  } catch {
    return json({ error: "Nie udało się zapisać profilu." }, 500);
  }
};
