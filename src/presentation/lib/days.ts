import { formatTime } from "./format";

const DAY_MS = 86_400_000;

/** Fechas "YYYY-MM-DD" de first a last, ambas incluidas. */
export function daysBetween(first: string, last: string): string[] {
  const end = Date.parse(`${last}T00:00:00Z`);
  const days: string[] = [];
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= end; t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/** Separa las horas en Mañana y Tarde (según la hora de la barbería) y omite la parte vacía. */
export function groupByDayPart(slots: readonly string[]) {
  const isMorning = (iso: string) => Number(formatTime(iso).slice(0, 2)) < 12;
  return [
    { label: "Mañana", slots: slots.filter(isMorning) },
    { label: "Tarde", slots: slots.filter((iso) => !isMorning(iso)) },
  ].filter((part) => part.slots.length > 0);
}
