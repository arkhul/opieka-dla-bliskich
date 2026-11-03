import { defineMiddleware } from "astro:middleware";
import { getAccountRole } from "@/lib/services/account.service";
import { createClient } from "@/lib/supabase";
import type { AccountRole } from "@/types";

const PROTECTED_ROUTES = ["/dashboard", "/profil"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
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
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
