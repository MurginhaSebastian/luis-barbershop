import type { BusinessHours } from "@/core/scheduling/availability";
import { WEEKDAYS } from "./format";

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
