import type { GminaDto } from "@/types";

// Gmina names repeat (even within one powiat, e.g. Łowicz miejska and wiejska),
// so the label always carries kind, powiat and województwo.
// Example: "Łowicz (gm. miejska, pow. łowicki, woj. łódzkie)".
export function formatGminaLabel(g: Pick<GminaDto, "name" | "kind" | "powiat" | "wojewodztwo">): string {
  return `${g.name} (gm. ${g.kind}, pow. ${g.powiat}, woj. ${g.wojewodztwo})`;
}
