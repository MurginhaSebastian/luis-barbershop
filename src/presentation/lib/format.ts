// Todo se muestra en la hora de la barbería, venga de donde venga el visitante.
const TIME_ZONE = "America/Lima";

const price = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const time = new Intl.DateTimeFormat("es-PE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const longDate = new Intl.DateTimeFormat("es-PE", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

const dayParts = new Intl.DateTimeFormat("es-PE", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const formatPrice = (cents: number) => price.format(cents / 100);
export const formatTime = (iso: string | Date) => time.format(new Date(iso));
export const formatLongDate = (iso: string | Date) => longDate.format(new Date(iso));

/** 600 → "10:00" (minutos desde medianoche local). */
export const formatMinuteOfDay = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** "2026-11-09" a { weekday: "lun", day: "9", month: "nov" }, para la tira de días. */
export function formatDayParts(date: string) {
  const parts = dayParts.formatToParts(new Date(date + "T12:00:00-05:00"));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value.replace(".", "") ?? "";
  return { weekday: value("weekday"), day: value("day"), month: value("month") };
}
