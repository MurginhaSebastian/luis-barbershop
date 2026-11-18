"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { cancellationMessage, confirmationMessage, whatsappLink } from "@/presentation/lib/whatsapp";

export type ChangeStatusAction = (id: string, status: AppointmentStatus) => Promise<{ error?: string }>;

// La etiqueta lleva siempre el estado en palabras: el color solo lo refuerza.
export const STATUS: Record<AppointmentStatus, { label: string; badge: string; card?: string }> = {
  PENDING: {
    label: "Separado · Por confirmar",
    badge: "border-status-pending bg-status-pending-surface text-status-pending-foreground",
    card: "border-status-pending bg-status-pending-surface",
  },
  CONFIRMED: {
    label: "Confirmada",
    badge: "border-status-confirmed bg-status-confirmed-surface text-status-confirmed-foreground",
    card: "border-status-confirmed bg-status-confirmed-surface",
  },
  AT_RISK: {
    label: "En riesgo · Hueco libre",
    badge: "border-status-risk bg-status-risk-surface text-status-risk-foreground",
    card: "border-2 border-dashed border-status-risk bg-status-risk-surface",
  },
  COMPLETED: { label: "Atendida", badge: "border-border text-muted-foreground" },
  CANCELLED: { label: "Cancelada", badge: "border-destructive/60 text-destructive" },
  NO_SHOW: { label: "No vino", badge: "border-destructive/60 text-destructive" },
  EXPIRED: { label: "Vencida, sin confirmar", badge: "border-border text-muted-foreground" },
};

const action = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors duration-200 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primary = `${action} bg-primary font-semibold text-primary-foreground hover:bg-accent hover:text-accent-foreground`;
const secondary = `${action} border border-input hover:border-primary`;

/** Una cita con lo que hace falta para atenderla y las acciones que su estado permite. */
export function AgendaCard(props: { item: AgendaItem; showDate?: boolean; changeStatus: ChangeStatusAction }) {
  const { item } = props;
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const finished = item.status !== "PENDING" && item.status !== "CONFIRMED" && item.status !== "AT_RISK";
  const minutes = Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60_000);

  const change = (status: AppointmentStatus, message?: string) => {
    // Se abre aquí, durante el toque: después del await el navegador lo bloquearía.
    if (message) window.open(whatsappLink(item.phone, message), "_blank", "noopener");
    startTransition(async () => setError((await props.changeStatus(item.id, status)).error));
  };

  const cancel = () => {
    if (window.confirm(`¿Cancelar la cita de ${item.customerName}? Se abrirá WhatsApp para avisarle.`)) {
      change("CANCELLED", cancellationMessage(item));
    }
  };

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

      {!finished && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status !== "CONFIRMED" && (
            <>
              <button type="button" disabled={pending} className={primary} onClick={() => change("CONFIRMED", confirmationMessage(item))}>
                <MessageCircle aria-hidden className="size-4" />
                Confirmar y avisar
              </button>
              <button type="button" disabled={pending} className={secondary} onClick={() => change("CONFIRMED")}>
                Confirmar sin avisar
              </button>
            </>
          )}
          {item.status !== "PENDING" && (
            <>
              <button type="button" disabled={pending} className={primary} onClick={() => change("COMPLETED")}>
                Atendida
              </button>
              <button type="button" disabled={pending} className={secondary} onClick={() => change("NO_SHOW")}>
                No vino
              </button>
              <a href={whatsappLink(item.phone, "")} target="_blank" rel="noopener noreferrer" className={secondary}>
                <MessageCircle aria-hidden className="size-4" />
                Escribirle
              </a>
            </>
          )}
          <button type="button" disabled={pending} className={secondary} onClick={cancel}>
            Cancelar
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}
