import type { AppointmentStatus } from "@/core/entities/appointment";

// La etiqueta lleva siempre el estado en palabras: el color solo lo refuerza.
export const STATUS: Record<AppointmentStatus, { label: string; short: string; badge: string; card?: string }> = {
  PENDING: {
    label: "Reservado · Por confirmar",
    short: "Reservado",
    badge: "border-status-pending bg-status-pending-surface text-status-pending-foreground",
    card: "border-status-pending bg-status-pending-surface",
  },
  CONFIRMED: {
    label: "Confirmado",
    short: "Confirmado",
    badge: "border-status-confirmed bg-status-confirmed-surface text-status-confirmed-foreground",
    card: "border-status-confirmed bg-status-confirmed-surface",
  },
  AT_RISK: {
    label: "En riesgo",
    short: "En riesgo",
    badge: "border-status-risk bg-status-risk-surface text-status-risk-foreground",
    card: "border-2 border-dashed border-status-risk bg-status-risk-surface",
  },
  COMPLETED: { label: "Atendido", short: "Atendido", badge: "border-border text-muted-foreground" },
  CANCELLED: { label: "Cancelado", short: "Cancelado", badge: "border-destructive/60 text-destructive" },
  NO_SHOW: { label: "No vino", short: "No vino", badge: "border-destructive/60 text-destructive" },
  EXPIRED: { label: "Vencido", short: "Vencido", badge: "border-border text-muted-foreground" },
};
