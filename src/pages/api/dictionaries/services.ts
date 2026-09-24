import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listServices } from "@/lib/services/dictionary.service";

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  try {
    const services = await listServices(supabase);
    return Response.json({ services });
  } catch {
    return Response.json({ error: "Failed to load services" }, { status: 500 });
  }
};
