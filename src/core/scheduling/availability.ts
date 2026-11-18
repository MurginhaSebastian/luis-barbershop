import { MINUTE_MS, TimeSlot } from "../entities/time-slot";
import { InvalidDateError } from "../errors/domain-errors";
import { MAX_DAYS_AHEAD, MIN_ADVANCE_MINUTES, SHOP_UTC_OFFSET_MINUTES, SLOT_STEP_MINUTES } from "./booking-policy";

/** Tramo de apertura en minutos desde la medianoche local (p. ej. 10:00–14:00 = 600–840). */
export interface BusinessHours {
  openMinute: number;
  closeMinute: number;
}

const DAY_MS = 24 * 60 * MINUTE_MS;

/** Medianoche local de la barbería para "YYYY-MM-DD", como instante UTC. */
function shopMidnight(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const midnight = match && Date.UTC(+match[1], +match[2] - 1, +match[3]);
  if (midnight === null || Number.isNaN(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new InvalidDateError(`Fecha inválida: ${date}`);
  }
  return new Date(midnight - SHOP_UTC_OFFSET_MINUTES * MINUTE_MS);
}

/** 0 = domingo … 6 = sábado, en el calendario local de la barbería. */
export function shopWeekday(date: string): number {
  shopMidnight(date);
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Fecha local de la barbería ("YYYY-MM-DD") en la que cae un instante. */
export function shopDateOf(instant: Date): string {
  return new Date(instant.getTime() + SHOP_UTC_OFFSET_MINUTES * MINUTE_MS).toISOString().slice(0, 10);
}

/** La fecha "YYYY-MM-DD" del calendario de la barbería, desplazada ese número de días (puede ser negativo). */
export function addDays(date: string, days: number): string {
  return shopDateOf(new Date(shopMidnight(date).getTime() + days * DAY_MS));
}

/** Instante de un día de la barbería, a esos minutos desde su medianoche (1440 = fin del día). */
export function shopInstant(date: string, minute: number): Date {
  return new Date(shopMidnight(date).getTime() + minute * MINUTE_MS);
}

/** Intervalo del día local completo, para pedir bloqueos y citas a los repositorios. */
export function shopDayRange(date: string): TimeSlot {
  const start = shopMidnight(date);
  return TimeSlot.create(start, new Date(start.getTime() + DAY_MS));
}

export function bookingWindow(now: Date): { notBefore: Date; notAfter: Date } {
  return {
    notBefore: new Date(now.getTime() + MIN_ADVANCE_MINUTES * MINUTE_MS),
    notAfter: new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS),
  };
}

/**
 * Inicios posibles del día cada SLOT_STEP_MINUTES desde la apertura de cada tramo y, además, justo al terminar
 * cada cita o bloqueo: tras una cita de 45 min no queda un hueco muerto de 15. El servicio debe caber antes del
 * cierre, no pisar nada ocupado y empezar dentro de la ventana de reserva.
 */
export function availableSlots(params: {
  date: string;
  hours: readonly BusinessHours[];
  busy: readonly TimeSlot[];
  durationMinutes: number;
  now: Date;
}): TimeSlot[] {
  const midnight = shopMidnight(params.date).getTime();
  const { notBefore, notAfter } = bookingWindow(params.now);
  const slots = new Map<number, TimeSlot>();

  for (const { openMinute, closeMinute } of params.hours) {
    const open = midnight + openMinute * MINUTE_MS;
    const close = midnight + closeMinute * MINUTE_MS;
    const grid = Array.from({ length: Math.ceil((closeMinute - openMinute) / SLOT_STEP_MINUTES) }, (_, i) => open + i * SLOT_STEP_MINUTES * MINUTE_MS);
    const ends = params.busy.map((b) => b.end.getTime()).filter((t) => t > open && t < close);
    for (const start of [...grid, ...ends]) {
      const slot = TimeSlot.ofMinutes(new Date(start), params.durationMinutes);
      if (slot.end.getTime() > close) continue;
      if (slot.start < notBefore || slot.start > notAfter) continue;
      if (params.busy.some((b) => slot.overlaps(b))) continue;
      slots.set(start, slot);
    }
  }
  return [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
