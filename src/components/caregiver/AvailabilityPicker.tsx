import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DAY_PARTS, WEEKDAYS, slotLabel, sortAvailability, toSlot, type AvailabilitySlot } from "@/lib/availability";
import { cn } from "@/lib/utils";

interface Props {
  value: AvailabilitySlot[];
  onChange: (next: AvailabilitySlot[]) => void;
  describedBy?: string;
}

// 7 days × 4 parts of the day; same layout and headers as AvailabilityGrid.astro. Fits 375 px: short day
// names on narrow screens, and each whole cell is the checkbox's hit area.
export function AvailabilityPicker({ value, onChange, describedBy }: Props) {
  const idPrefix = useId();
  const selected = new Set<AvailabilitySlot>(value);

  function toggle(slot: AvailabilitySlot, checked: boolean) {
    onChange(sortAvailability(checked ? [...value, slot] : value.filter((s) => s !== slot)));
  }

  return (
    <table className="w-full table-fixed border-collapse text-sm" aria-describedby={describedBy}>
      <thead>
        <tr>
          <td className="w-9 sm:w-32" />
          {DAY_PARTS.map((part) => (
            <th
              key={part.value}
              scope="col"
              className="px-0.5 pb-1 text-center align-bottom text-xs leading-tight font-normal hyphens-auto text-blue-100/80"
            >
              <span className="block">{part.label}</span>
              <span className="block text-blue-100/50">{part.hours}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {WEEKDAYS.map((day) => (
          <tr key={day.value} className="border-t border-white/10">
            <th scope="row" className="pr-1 text-left font-normal text-blue-100/80">
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.label}</span>
            </th>
            {DAY_PARTS.map((part) => {
              const slot = toSlot(day.value, part.value);
              const id = `${idPrefix}-${slot}`;
              const checked = selected.has(slot);
              return (
                <td key={slot} className="p-0.5">
                  <Label
                    htmlFor={id}
                    className={cn(
                      "flex h-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/10",
                      checked && "bg-purple-500/20",
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(state) => {
                        toggle(slot, state === true);
                      }}
                      aria-label={slotLabel(slot)}
                      className="size-5 border-white/40 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white"
                    />
                  </Label>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
