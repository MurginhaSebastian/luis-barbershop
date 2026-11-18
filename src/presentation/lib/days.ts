import { addDays } from "@/core/scheduling/availability";
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

/** La fecha "YYYY-MM-DD" desplazada ese número de días. */
export function shiftDay(date: string, days: number): string {
  return addDays(date, days);
}

/** Separa las horas en Mañana y Tarde (según la hora de la barbería) y omite la parte vacía. */
export function groupByDayPart(slots: readonly string[]) {
  const isMorning = (iso: string) => Number(formatTime(iso).slice(0, 2)) < 12;
  return [
    { label: "Mañana", slots: slots.filter(isMorning) },
    { label: "Tarde", slots: slots.filter((iso) => !isMorning(iso)) },
  ].filter((part) => part.slots.length > 0);
}

/** La fecha de referencia del periodo anterior/siguiente: día ±1, semana ±7, mes → día 1 del mes anterior/siguiente. */
export function shiftPeriod(view: "dia" | "semana" | "mes", date: string, step: 1 | -1): string {
  if (view === "dia") return addDays(date, step);
  if (view === "semana") return addDays(date, 7 * step);
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + step;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** Las fechas visibles en filas de 7 (para la vista mes). */
export function weeks(days: readonly string[]): string[][] {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));
}
