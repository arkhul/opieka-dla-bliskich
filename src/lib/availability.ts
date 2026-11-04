// Caregiver availability slots: one weekday × one part of the day, written "<day>-<part>" (e.g. "pon-rano")
// in the database, RPC and API arrays and the URL. This module is the single source of the slots, their
// canonical order (Monday to Sunday, morning to night within a day) and their Polish labels.

export const WEEKDAYS = [
  { value: "pon", label: "Poniedziałek", short: "Pn" },
  { value: "wt", label: "Wtorek", short: "Wt" },
  { value: "sr", label: "Środa", short: "Śr" },
  { value: "czw", label: "Czwartek", short: "Cz" },
  { value: "pt", label: "Piątek", short: "Pt" },
  { value: "sob", label: "Sobota", short: "Sb" },
  { value: "nd", label: "Niedziela", short: "Nd" },
] as const;

// "noc" is the night starting on the given day: 22 on that day to 6 the next morning.
export const DAY_PARTS = [
  { value: "rano", label: "rano", hours: "6–12" },
  { value: "popoludnie", label: "popołudnie", hours: "12–18" },
  { value: "wieczor", label: "wieczór", hours: "18–22" },
  { value: "noc", label: "noc", hours: "22–6" },
] as const;

export type Weekday = (typeof WEEKDAYS)[number]["value"];
export type DayPart = (typeof DAY_PARTS)[number]["value"];
export type AvailabilitySlot = `${Weekday}-${DayPart}`;

export function toSlot(weekday: Weekday, dayPart: DayPart): AvailabilitySlot {
  return `${weekday}-${dayPart}`;
}

// All 28 slots in canonical order.
export const AVAILABILITY_SLOTS: readonly AvailabilitySlot[] = WEEKDAYS.flatMap((day) =>
  DAY_PARTS.map((part) => toSlot(day.value, part.value)),
);

const SLOT_INDEX = new Map<string, number>(AVAILABILITY_SLOTS.map((slot, index) => [slot, index]));

const SLOT_LABELS = new Map<string, string>(
  WEEKDAYS.flatMap((day) => DAY_PARTS.map((part) => [toSlot(day.value, part.value), `${day.label}, ${part.label}`])),
);

export function isAvailabilitySlot(value: string): value is AvailabilitySlot {
  return SLOT_INDEX.has(value);
}

// Drops unknown values and duplicates, and puts the rest in canonical order.
export function sortAvailability(values: readonly string[]): AvailabilitySlot[] {
  return [...new Set(values)]
    .filter(isAvailabilitySlot)
    .sort((a, b) => (SLOT_INDEX.get(a) ?? 0) - (SLOT_INDEX.get(b) ?? 0));
}

// Accessible label of one slot, e.g. "Poniedziałek, rano".
export function slotLabel(slot: AvailabilitySlot): string {
  return SLOT_LABELS.get(slot) ?? slot;
}

// Days as "Pn–Pt" for runs of 2 or more consecutive days and "Sb" for single days, runs joined with ", ".
function formatDays(dayIndexes: number[]): string {
  const runs: number[][] = [];
  for (const index of dayIndexes) {
    const run = runs.at(-1);
    if (run?.at(-1) === index - 1) {
      run.push(index);
    } else {
      runs.push([index]);
    }
  }
  return runs
    .map((run) =>
      run.length >= 2 ? `${WEEKDAYS[run[0]].short}–${WEEKDAYS[run[run.length - 1]].short}` : WEEKDAYS[run[0]].short,
    )
    .join(", ");
}

// One-line summary, e.g. "Pn–Pt: rano · Sb: noc": days with the same parts of the day form a group (groups in
// the order of their first day), the parts follow in canonical order. null for no slots.
export function summarizeAvailability(slots: readonly AvailabilitySlot[]): string | null {
  const selected = new Set<string>(slots);
  const groups = new Map<string, { days: number[]; parts: string[] }>();

  WEEKDAYS.forEach((day, dayIndex) => {
    const parts = DAY_PARTS.filter((part) => selected.has(toSlot(day.value, part.value))).map((part) => part.label);
    if (parts.length === 0) {
      return;
    }
    const key = parts.join(",");
    const group = groups.get(key);
    if (group) {
      group.days.push(dayIndex);
    } else {
      groups.set(key, { days: [dayIndex], parts });
    }
  });

  if (groups.size === 0) {
    return null;
  }

  return [...groups.values()].map(({ days, parts }) => `${formatDays(days)}: ${parts.join(", ")}`).join(" · ");
}
