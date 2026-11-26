import type { AppointmentStatus } from "@/core/entities/appointment";

/**
 * Plazo de una cita sin confirmar, en palabras: una pendiente vence en su `confirmBy`; una en riesgo, a su hora.
 * Null si no hay plazo que mostrar.
 */
export function expiryLabel(item: { status: AppointmentStatus; start: string; confirmBy?: string }, nowMs: number): string | null {
  const deadline = item.status === "AT_RISK" ? item.start : item.status === "PENDING" ? item.confirmBy : undefined;
  if (!deadline) return null;
  const minutes = Math.ceil((Date.parse(deadline) - nowMs) / 60_000);
  if (minutes <= 0) return "Vence ya";
  if (minutes < 60) return `Vence en ${minutes} min`;
  if (minutes < 1440) return `Vence en ${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return `Vence en ${Math.floor(minutes / 1440)} d`;
}
