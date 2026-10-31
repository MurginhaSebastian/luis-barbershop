import type { BusinessHours } from "@/core/scheduling/availability";
import { formatMinuteOfDay, WEEKDAYS } from "@/presentation/lib/format";

/** Horario semanal empezando por el lunes; `weeklyHours[0]` es el domingo. */
export function WeeklyHours({ weeklyHours }: { weeklyHours: BusinessHours[][] }) {
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  return (
    <dl className="space-y-2 text-sm">
      {mondayFirst.map((day) => {
        const hours = weeklyHours[day] ?? [];
        return (
          <div key={day} className="flex justify-between gap-4">
            <dt>{WEEKDAYS[day]}</dt>
            <dd className={hours.length ? "tabular-nums text-foreground" : "text-muted-foreground"}>
              {hours.length
                ? hours.map((h) => `${formatMinuteOfDay(h.openMinute)}–${formatMinuteOfDay(h.closeMinute)}`).join(" y ")
                : "Cerrado"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
