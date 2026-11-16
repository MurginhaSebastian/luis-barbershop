import { MINUTE_MS } from "@/core/entities/time-slot";
import { SHOP_UTC_OFFSET_MINUTES } from "@/core/scheduling/booking-policy";

const dateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Fecha y hora de una cita como se lee en un aviso o un mensaje: "lun, 16 nov, 10:00", en hora de Lima. */
export const shopDateTime = (date: Date) => dateTime.format(date);

const time = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false });

/** Solo la hora, en hora de Lima: "16:00". */
export const shopTime = (date: Date) => time.format(date);

const offset = `${SHOP_UTC_OFFSET_MINUTES < 0 ? "-" : "+"}${[Math.floor(Math.abs(SHOP_UTC_OFFSET_MINUTES) / 60), Math.abs(SHOP_UTC_OFFSET_MINUTES) % 60]
  .map((n) => String(n).padStart(2, "0"))
  .join(":")}`;

/** El instante en hora de Lima con su desfase, "2026-11-12T16:00:00-05:00": así lo lee y lo devuelve el asistente. */
export function shopIso(date: Date): string {
  return `${new Date(date.getTime() + SHOP_UTC_OFFSET_MINUTES * MINUTE_MS).toISOString().slice(0, 19)}${offset}`;
}
