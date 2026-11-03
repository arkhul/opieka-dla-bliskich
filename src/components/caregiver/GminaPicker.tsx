import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GminaDto } from "@/types";

export const MAX_GMINAS = 30;
const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 250;

export type SelectedGmina = GminaDto & { active: boolean };

interface Props {
  id?: string;
  value: SelectedGmina[];
  onChange: (next: SelectedGmina[]) => void;
  invalid?: boolean;
  describedBy?: string;
}

// Result of the last finished search; results belong to `query` only, so a stale one is never shown.
interface SearchResult {
  query: string;
  status: "done" | "invalid" | "error";
  gminas: GminaDto[];
}

export function GminaPicker({ id, value, onChange, invalid, describedBy }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  const trimmedQuery = query.trim();
  const tooShort = trimmedQuery.length < MIN_QUERY_LENGTH;
  const current = result?.query === trimmedQuery ? result : null;
  const loading = !tooShort && !current;
  const atLimit = value.length >= MAX_GMINAS;

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

  const selectedCodes = new Set(value.map((g) => g.teryt));

  function add(gmina: GminaDto) {
    if (atLimit || selectedCodes.has(gmina.teryt)) {
      return;
    }
    // The search API returns active gminas only.
    onChange([...value, { ...gmina, active: true }]);
  }

  function remove(teryt: string) {
    onChange(value.filter((g) => g.teryt !== teryt));
  }

  let status: string | null = null;
  if (atLimit) {
    status = `Wybrano już ${MAX_GMINAS} gmin — to maksimum. Usuń którąś, aby dodać inną.`;
  } else if (tooShort) {
    status = `Wpisz co najmniej ${MIN_QUERY_LENGTH} litery nazwy gminy.`;
  } else if (loading) {
    status = "Szukam…";
  } else if (current?.status === "invalid") {
    status = "Nazwa gminy może zawierać tylko litery, spacje, „-” i „.”.";
  } else if (current?.status === "error") {
    status = "Nie udało się wyszukać gmin. Spróbuj ponownie.";
  } else if (current?.gminas.length === 0) {
    status = "Nie znaleziono gminy o tej nazwie.";
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((gmina) => (
            <li key={gmina.teryt} className="max-w-full">
              <Badge
                variant="outline"
                className={cn(
                  "h-auto max-w-full gap-1.5 rounded-lg py-1 pr-1 pl-2.5 text-left text-xs font-normal whitespace-normal",
                  gmina.active
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-amber-400/50 bg-amber-900/30 text-amber-100",
                )}
              >
                <span className="break-words">
                  {gmina.label}
                  {!gmina.active && <span className="block font-medium text-amber-300">gmina wycofana — usuń ją</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    remove(gmina.teryt);
                  }}
                  aria-label={`Usuń gminę ${gmina.label}`}
                  className="shrink-0 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full justify-start rounded-lg border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white",
              invalid && "border-red-400/60",
            )}
          >
            <Plus className="size-4" />
            Dodaj gminę
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 border-white/10 bg-[#0f1529] p-0 text-white"
        >
          <Command shouldFilter={false} className="bg-transparent text-white">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Wpisz nazwę gminy, np. Łódź"
              aria-label="Szukaj gminy"
              className="text-white placeholder:text-white/40"
            />
            <CommandList>
              {status && <p className="px-3 py-4 text-center text-sm text-blue-100/60">{status}</p>}
              {!atLimit && current?.status === "done" && current.gminas.length > 0 && (
                <CommandGroup>
                  {current.gminas.map((gmina) => {
                    const selected = selectedCodes.has(gmina.teryt);
                    return (
                      <CommandItem
                        key={gmina.teryt}
                        value={gmina.teryt}
                        disabled={selected}
                        onSelect={() => {
                          add(gmina);
                        }}
                        className="items-start text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
                      >
                        <Check
                          className={cn("mt-0.5 size-4 text-purple-300", selected ? "opacity-100" : "opacity-0")}
                        />
                        <span className="whitespace-normal">
                          {gmina.label}
                          {selected && <span className="sr-only"> (już wybrana)</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className={cn("text-xs", atLimit ? "text-amber-300" : "text-blue-100/50")}>
        Wybrano {value.length} z {MAX_GMINAS} gmin.
      </p>
    </div>
  );
}
