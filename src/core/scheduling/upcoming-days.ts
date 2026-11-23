import { addDays, shopDateOf, shopWeekday } from "./availability";

const SHORT_DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "hoy mar 24/11 (2026-11-24); mañana mié 25/11 (2026-11-25); jue 26/11 (2026-11-26)…": los próximos días de Lima, para no calcular el día de la semana. */
export function describeUpcomingDays(now: Date, count = 7): string {
  const today = shopDateOf(now);
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i);
    const [, month, day] = date.split("-");
    const prefix = i === 0 ? "hoy " : i === 1 ? "mañana " : "";
    return `${prefix}${SHORT_DAYS[shopWeekday(date)]} ${day}/${month} (${date})`;
  }).join("; ");
}
