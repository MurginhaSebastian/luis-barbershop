import type { AppointmentStatus } from "@/core/entities/appointment";

const PENDING = "border-status-pending-border bg-status-pending-bg text-status-pending-text";
const CONFIRMED = "border-status-confirmed-border bg-status-confirmed-bg text-status-confirmed-text";
const RISK = "border-status-risk-border bg-status-risk-bg text-status-risk-text";
const DONE = "border-status-done-border bg-status-done-bg text-status-done-text";
const LOST = "border-destructive-border bg-light-card text-destructive-text";

// La etiqueta lleva siempre el estado en palabras: el color solo lo refuerza.
export const STATUS: Record<AppointmentStatus, { label: string; short: string; badge: string }> = {
  PENDING: { label: "Reservado · Por confirmar", short: "Reservado", badge: PENDING },
  CONFIRMED: { label: "Confirmado", short: "Confirmado", badge: CONFIRMED },
  AT_RISK: { label: "En riesgo", short: "En riesgo", badge: RISK },
  COMPLETED: { label: "Atendido", short: "Atendido", badge: DONE },
  CANCELLED: { label: "Cancelado", short: "Cancelado", badge: LOST },
  NO_SHOW: { label: "No vino", short: "No vino", badge: LOST },
  EXPIRED: { label: "Vencido", short: "Vencido", badge: DONE },
};
