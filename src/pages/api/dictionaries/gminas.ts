import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { searchGminas } from "@/lib/services/dictionary.service";

// Letters (any script), spaces, "-" and "." only: gmina names never need more,
// and this keeps LIKE wildcards ("%", "_") and other symbols out of the search.
const querySchema = z.object({
  q: z
    .string({ error: "q is required" })
    .trim()
    .min(2, { error: "q must be at least 2 characters" })
    .max(50, { error: "q must be at most 50 characters" })
    .regex(/^[\p{L} .-]+$/u, { error: "q may contain only letters, spaces, '-' and '.'" }),
  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int({ error: "limit must be an integer" })
    .min(1, { error: "limit must be between 1 and 50" })
    .max(50, { error: "limit must be between 1 and 50" })
    .default(20),
});

export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const gminas = await searchGminas(supabase, parsed.data.q, parsed.data.limit);
    return Response.json({ gminas });
  } catch {
    return Response.json({ error: "Failed to search gminas" }, { status: 500 });
  }
};
