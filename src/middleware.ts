import { defineMiddleware } from "astro:middleware";
import { getAccountRole } from "@/lib/services/account.service";
import { withNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase";
import type { AccountRole } from "@/types";

const PROTECTED_ROUTES = ["/dashboard", "/profil", "/kontakt"];

// The app lives on hosts search engines may index (*.workers.dev, preview URLs), and it serves caregiver
// profiles and contact data: keep every response out of search results until indexing is a deliberate decision.
function withNoindex(response: Response): Response {
  try {
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  } catch {
    // Immutable headers (e.g. a proxied fetch response): clone the response to get mutable ones.
    const clone = new Response(response.body, response);
    clone.headers.set("X-Robots-Tag", "noindex");
    return clone;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  // The dictionaries feed autocomplete (one request per keystroke) and never read locals.user or locals.getRole:
  // skip the Supabase Auth round trip there. With no user, getRole below resolves to null.
  if (context.url.pathname.startsWith("/api/dictionaries/")) {
    context.locals.user = null;
  } else if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // Lazy and memoized: the role is read at most once per request (page + Topbar share it),
  // and not at all on requests that never ask. A failed read rejects; callers decide how to degrade.
  const user = context.locals.user;
  let rolePromise: Promise<AccountRole | null> | undefined;
  context.locals.getRole = () =>
    (rolePromise ??= user && supabase ? getAccountRole(supabase, user.id) : Promise.resolve(null));

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return withNoindex(context.redirect(withNext("/auth/signin", context.url.pathname + context.url.search)));
    }
  }

  return withNoindex(await next());
});
