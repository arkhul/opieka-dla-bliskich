// Pure helpers for the post-sign-in return address ("next"). One place validates it, so no endpoint or page
// ever redirects to an address that did not pass through safeNextPath().

// A throwaway origin: a value that resolves to any other origin is not a local path.
const BASE = "http://app.invalid";
const MAX_LENGTH = 2048;
// Control characters (C0 and DEL) never belong in a path, and browsers strip some of them while parsing.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// Redirect loops (auth pages) and POST-only endpoints (API) are never a sensible place to return to.
const FORBIDDEN_PREFIXES = ["/api", "/auth"];

/** Returns `pathname + search` of a local path, or null when the value is missing or could leave the app. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return null;
  // Exactly one leading slash: "//host" is protocol-relative and "/\host" is read as "//host" by browsers.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (CONTROL_CHARACTERS.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;

  // Checked on the normalized pathname, so "/x/../api/y" cannot slip through.
  const { pathname, search } = url;
  if (FORBIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  const target = pathname + search;
  // Normalization collapses dot segments, so "/.//host" becomes "//host" (protocol-relative): check the result too.
  if (target.startsWith("//") || target.startsWith("/\\")) return null;

  return target;
}

/** Appends an already validated `next` (encoded) to a path, keeping its existing query (e.g. `error`). */
export function withNext(path: string, next: string | null): string {
  if (!next) return path;
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
