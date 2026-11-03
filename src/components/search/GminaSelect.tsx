import { useState } from "react";
import { Check, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGminaSearch, MIN_QUERY_LENGTH } from "@/hooks/useGminaSearch";
import { cn } from "@/lib/utils";
import type { GminaDto } from "@/types";

interface Props {
  name: string;
  initial: GminaDto | null;
}

// Single-choice gmina combobox for a native GET form: the chosen TERC code goes into a hidden input.
// Every button is type="button", so only the form's own submit button sends the filters.
export function GminaSelect({ name, initial }: Props) {
  const [selected, setSelected] = useState<GminaDto | null>(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useGminaSearch(query);

  let status: string | null = null;
  if (search.status === "too-short") {
    status = `Wpisz co najmniej ${MIN_QUERY_LENGTH} litery nazwy gminy.`;
  } else if (search.status === "loading") {
    status = "Szukam…";
  } else if (search.status === "invalid") {
    status = "Nazwa gminy może zawierać tylko litery, spacje, „-” i „.”.";
  } else if (search.status === "error") {
    status = "Nie udało się wyszukać gmin. Spróbuj ponownie.";
  } else if (search.gminas.length === 0) {
    status = "Nie znaleziono gminy o tej nazwie.";
  }

  return (
    <div className="flex items-start gap-2">
      <input type="hidden" name={name} value={selected?.teryt ?? ""} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 min-w-0 flex-1 shrink justify-start rounded-lg border-white/20 bg-white/10 py-2 text-left whitespace-normal text-white/80 hover:bg-white/20 hover:text-white"
          >
            <MapPin className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{selected ? selected.label : "Wybierz gminę"}</span>
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
              {search.status === "done" && search.gminas.length > 0 && (
                <CommandGroup>
                  {search.gminas.map((gmina) => (
                    <CommandItem
                      key={gmina.teryt}
                      value={gmina.teryt}
                      onSelect={() => {
                        setSelected(gmina);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="items-start text-white data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
                    >
                      <Check
                        className={cn(
                          "mt-0.5 size-4 text-purple-300",
                          selected?.teryt === gmina.teryt ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="whitespace-normal">{gmina.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Usuń gminę"
          onClick={() => {
            setSelected(null);
          }}
          className="shrink-0 rounded-lg border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
