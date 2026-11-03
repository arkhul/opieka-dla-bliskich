import type { CaregiverMissingItem } from "@/types";

const MISSING_ITEM_LABELS: Record<CaregiverMissingItem, string> = {
  display_name: "imię",
  phone: "numer telefonu",
  gminas: "co najmniej jedna gmina",
  services: "co najmniej jedna usługa",
};

// Polish text for an item the completeness rule reports, as shown on the profile preview.
export function missingItemLabel(item: CaregiverMissingItem): string {
  return MISSING_ITEM_LABELS[item];
}
