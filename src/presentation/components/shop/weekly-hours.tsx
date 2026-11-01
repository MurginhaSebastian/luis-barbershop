import type { BusinessHours } from "@/core/scheduling/availability";
import { formatMinuteOfDay, WEEKDAYS } from "@/presentation/lib/format";
import { groupWeekdays, type WeekdayGroup } from "@/presentation/lib/hours";

const position = (day: number) => (day + 6) % 7; // lunes = 0 … domingo = 6

function daysLabel({ first, last }: WeekdayGroup) {
  if (first === last) return WEEKDAYS[first];
  const joiner = position(last) - position(first) === 1 ? " y " : " a ";
  return `${WEEKDAYS[first]}${joiner}${WEEKDAYS[last].toLowerCase()}`;
}

/** Horario semanal compacto: los días seguidos con el mismo horario van en una sola línea. */
export function WeeklyHours({ weeklyHours }: { weeklyHours: BusinessHours[][] }) {
  return (
    <dl className="space-y-5">
      {groupWeekdays(weeklyHours).map((group) => (
        <div key={group.first}>
          <dt className="font-heading text-xl">{daysLabel(group)}</dt>
          <dd className={group.hours.length ? "tabular-nums text-primary" : "text-muted-foreground"}>
            {group.hours.length
              ? group.hours.map((h) => `${formatMinuteOfDay(h.openMinute)}–${formatMinuteOfDay(h.closeMinute)}`).join(" y ")
              : "Cerrado"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
