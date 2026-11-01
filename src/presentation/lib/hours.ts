import type { BusinessHours } from "@/core/scheduling/availability";

export interface WeekdayGroup {
  /** 0 = domingo … 6 = sábado. */
  first: number;
  last: number;
  hours: BusinessHours[];
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
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
