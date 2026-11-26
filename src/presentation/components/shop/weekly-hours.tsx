import type { BusinessHours } from "@/core/scheduling/availability";
import { formatMinuteOfDay } from "@/presentation/lib/format";
import { daysLabel, groupWeekdays } from "@/presentation/lib/hours";

/** Horario semanal compacto: los días seguidos con el mismo horario van en una sola línea. */
export function WeeklyHours({ weeklyHours, light }: { weeklyHours: BusinessHours[][]; light?: boolean }) {
  return (
    <dl className="space-y-5">
      {groupWeekdays(weeklyHours).map((group) => (
        <div key={group.first}>
          <dt className="font-heading text-xl">{daysLabel(group)}</dt>
          <dd className={group.hours.length ? `tabular-nums ${light ? "text-gold-on-light" : "text-primary"}` : light ? "text-light-muted" : "text-muted-foreground"}>
            {group.hours.length
              ? group.hours.map((h) => `${formatMinuteOfDay(h.openMinute)}–${formatMinuteOfDay(h.closeMinute)}`).join(" y ")
              : "Cerrado"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
