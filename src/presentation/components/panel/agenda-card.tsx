"use client";

import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { AppointmentActions, type ChangeStatusAction } from "./appointment-actions";

export type { ChangeStatusAction };

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

/** Una cita con lo que hace falta para atenderla y las acciones que su estado permite. */
export function AgendaCard(props: { item: AgendaItem; showDate?: boolean; changeStatus: ChangeStatusAction }) {
  const { item } = props;
  const finished = item.status !== "PENDING" && item.status !== "CONFIRMED" && item.status !== "AT_RISK";
  const minutes = Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60_000);

  return (
    <article
      aria-label={`${formatTime(item.start)}, ${item.customerName}`}
      className={cn(
        "flex-1 rounded-2xl border border-border bg-card p-4 wrap-anywhere",
        STATUS[item.status].card,
        finished && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          {props.showDate && <p className="text-sm first-letter:uppercase text-muted-foreground">{formatLongDate(item.start)}</p>}
          <p className="font-heading text-2xl tabular-nums sm:text-3xl">
            {formatTime(item.start)} – {formatTime(item.end)}
            <span className="font-sans text-sm text-muted-foreground"> · {minutes} min</span>
          </p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", STATUS[item.status].badge)}>
          {STATUS[item.status].label}
        </span>
      </div>

      <p className="mt-2 text-lg font-medium">{item.customerName}</p>
      {item.phone && (
        <p className="text-sm tabular-nums">
          <a href={`tel:+${item.phone}`} className="underline underline-offset-2 hover:text-primary">
            +{item.phone}
          </a>
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {item.services.join(", ")} con {item.barberName}
      </p>
      {item.products.length > 0 && <p className="text-sm text-muted-foreground">Para llevar: {item.products.join(", ")}</p>}
      <p className="mt-1 tabular-nums text-primary">{formatPrice(item.totalCents)}</p>
      {item.status === "PENDING" && item.confirmBy && (
        <p className="mt-2 text-sm text-muted-foreground">
          El cliente puede confirmar por WhatsApp hasta las {formatTime(item.confirmBy)}; después, otro cliente puede tomar la hora.
        </p>
      )}

      {item.status === "AT_RISK" && (
        <p className="mt-2 text-sm text-muted-foreground">
          No confirmó a tiempo: otro cliente puede reservar esta hora. Si llega o te avisa, confírmala o márcala atendida.
        </p>
      )}

      <AppointmentActions item={item} changeStatus={props.changeStatus} />
    </article>
  );
}
