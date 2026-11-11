import { type BusinessHours, shopDateOf, shopWeekday } from "@/core/scheduling/availability";
import type { OpeningStatus } from "@/core/scheduling/opening-status";
import { formatLongDate, formatTime, WEEKDAYS } from "./format";

export interface WeekdayGroup {
  /** 0 = domingo … 6 = sábado. */
  first: number;
  last: number;
  hours: BusinessHours[];
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const position = (day: number) => (day + 6) % 7; // lunes = 0 … domingo = 6

/** "Domingo", "Lunes y martes" o "Lunes a sábado". */
export function daysLabel({ first, last }: WeekdayGroup): string {
  if (first === last) return WEEKDAYS[first];
  const joiner = position(last) - position(first) === 1 ? " y " : " a ";
  return `${WEEKDAYS[first]}${joiner}${WEEKDAYS[last].toLowerCase()}`;
}
const sameHours = (a: BusinessHours[], b: BusinessHours[]) => JSON.stringify(a) === JSON.stringify(b);

/** Agrupa los días seguidos (de lunes a domingo) que tienen exactamente los mismos tramos. */
export function groupWeekdays(weeklyHours: BusinessHours[][]): WeekdayGroup[] {
  const groups: WeekdayGroup[] = [];
  for (const day of MONDAY_FIRST) {
    const hours = weeklyHours[day] ?? [];
    const last = groups.at(-1);
    if (last && sameHours(last.hours, hours)) last.last = day;
    else groups.push({ first: day, last: day, hours });
  }
  return groups;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Abierto ahora, hasta las 20:00", "Cerrado. Abre mañana a las 10:00"… en la hora de Lima. */
export function describeOpening(status: OpeningStatus | null, now: Date): string | null {
  if (!status) return null;
  if (status.open) return `Abierto ahora, hasta las ${formatTime(status.until)}`;
  const day = shopDateOf(status.opensAt);
  const at = formatTime(status.opensAt);
  if (day === shopDateOf(now)) return `Cerrado ahora. Abre hoy a las ${at}`;
  if (day === shopDateOf(new Date(now.getTime() + DAY_MS))) return `Cerrado. Abre mañana a las ${at}`;
  if (status.opensAt.getTime() - now.getTime() < 6 * DAY_MS) {
    return `Cerrado. Abre el ${WEEKDAYS[shopWeekday(day)].toLowerCase()} a las ${at}`;
  }
  return `Cerrado. Abre el ${formatLongDate(status.opensAt)}`;
}
