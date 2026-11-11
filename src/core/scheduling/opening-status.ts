import { MINUTE_MS, TimeSlot } from "../entities/time-slot";
import { type BusinessHours, shopDateOf, shopInstant, shopWeekday } from "./availability";

export type OpeningStatus = { open: true; until: Date } | { open: false; opensAt: Date };

const DAY_MS = 24 * 60 * MINUTE_MS;
/** Un cierre por vacaciones puede durar semanas; más allá, no se anuncia ninguna apertura. */
const DAYS_TO_SEARCH = 30;

/**
 * Si la barbería está abierta ahora y hasta cuándo o, si no, cuándo vuelve a abrir. Los cierres de toda la
 * barbería (feriados, vacaciones) se descuentan del horario semanal. null: no abre en los próximos 30 días.
 */
export function openingStatus(
  weeklyHours: readonly (readonly BusinessHours[])[],
  closures: readonly TimeSlot[],
  now: Date,
): OpeningStatus | null {
  const upcoming: TimeSlot[] = [];
  for (let day = 0; day < DAYS_TO_SEARCH; day++) {
    const date = shopDateOf(new Date(now.getTime() + day * DAY_MS));
    const hours = [...(weeklyHours[shopWeekday(date)] ?? [])].sort((a, b) => a.openMinute - b.openMinute);
    for (const h of hours) {
      const range = TimeSlot.create(shopInstant(date, h.openMinute), shopInstant(date, h.closeMinute));
      upcoming.push(...withoutClosures(range, closures).filter((part) => part.end > now));
    }
  }

  const [first, ...rest] = upcoming;
  if (!first) return null;
  if (first.start > now) return { open: false, opensAt: first.start };
  // Tramos que se tocan (14:00–15:00 y 15:00–20:00) cuentan como uno solo.
  let until = first.end;
  for (const next of rest) {
    if (next.start.getTime() !== until.getTime()) break;
    until = next.end;
  }
  return { open: true, until };
}

function withoutClosures(range: TimeSlot, closures: readonly TimeSlot[]): TimeSlot[] {
  let parts = [range];
  for (const closure of closures) {
    parts = parts.flatMap((part) => {
      if (!part.overlaps(closure)) return [part];
      const left = part.start < closure.start ? [TimeSlot.create(part.start, closure.start)] : [];
      const right = closure.end < part.end ? [TimeSlot.create(closure.end, part.end)] : [];
      return [...left, ...right];
    });
  }
  return parts;
}
