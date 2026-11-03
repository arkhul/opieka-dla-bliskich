import { useEffect, useState } from "react";
import type { GminaDto } from "@/types";

export const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 250;

export type GminaSearchStatus = "too-short" | "loading" | "done" | "invalid" | "error";

// Result of the last finished search; results belong to `query` only, so a stale one is never shown.
interface SearchResult {
  query: string;
  status: "done" | "invalid" | "error";
  gminas: GminaDto[];
}

// Debounced, abortable gmina search against /api/dictionaries/gminas; a query shorter than the minimum is not sent.
export function useGminaSearch(query: string): { status: GminaSearchStatus; gminas: GminaDto[] } {
  const [result, setResult] = useState<SearchResult | null>(null);

  const trimmedQuery = query.trim();
  const tooShort = trimmedQuery.length < MIN_QUERY_LENGTH;
  const current = result?.query === trimmedQuery ? result : null;

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/dictionaries/gminas?q=${encodeURIComponent(trimmedQuery)}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            // 400: the query has characters a gmina name never contains (digits, symbols).
            setResult({ query: trimmedQuery, status: response.status === 400 ? "invalid" : "error", gminas: [] });
            return;
          }
          const body = (await response.json()) as { gminas: GminaDto[] };
          setResult({ query: trimmedQuery, status: "done", gminas: body.gminas });
        } catch {
          if (!controller.signal.aborted) {
            setResult({ query: trimmedQuery, status: "error", gminas: [] });
          }
        }
      })();
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  if (tooShort) {
    return { status: "too-short", gminas: [] };
  }
  if (!current) {
    return { status: "loading", gminas: [] };
  }
  return { status: current.status, gminas: current.gminas };
}
