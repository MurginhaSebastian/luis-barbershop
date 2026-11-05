"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { cancellationMessage, confirmationMessage, whatsappLink } from "@/presentation/lib/whatsapp";

export type ChangeStatusAction = (id: string, status: AppointmentStatus) => Promise<{ error?: string }>;

const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  PENDING: { label: "Por confirmar", className: "border-primary text-primary" },
  CONFIRMED: { label: "Confirmada", className: "border-foreground/60 text-foreground" },
  COMPLETED: { label: "Atendida", className: "border-border text-muted-foreground" },
  CANCELLED: { label: "Cancelada", className: "border-destructive/60 text-destructive" },
  NO_SHOW: { label: "No vino", className: "border-destructive/60 text-destructive" },
};

const action = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors duration-200 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primary = `${action} bg-primary font-semibold text-primary-foreground hover:bg-accent hover:text-accent-foreground`;
const secondary = `${action} border border-input hover:border-primary`;

/** Una cita con lo que hace falta para atenderla y las acciones que su estado permite. */
export function AgendaCard(props: { item: AgendaItem; showDate?: boolean; changeStatus: ChangeStatusAction }) {
  const { item } = props;
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const finished = item.status === "CANCELLED" || item.status === "NO_SHOW" || item.status === "COMPLETED";

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
      className={cn("rounded-2xl border border-border bg-card p-4", finished && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {props.showDate && <p className="text-sm first-letter:uppercase text-muted-foreground">{formatLongDate(item.start)}</p>}
          <p className="font-heading text-3xl tabular-nums">{formatTime(item.start)}</p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs", STATUS[item.status].className)}>
          {STATUS[item.status].label}
        </span>
      </div>

      <p className="mt-2 text-lg font-medium">{item.customerName}</p>
      <p className="text-sm text-muted-foreground">
        {item.services.join(", ")} con {item.barberName}
      </p>
      {item.products.length > 0 && <p className="text-sm text-muted-foreground">Para llevar: {item.products.join(", ")}</p>}
      <p className="mt-1 tabular-nums text-primary">{formatPrice(item.totalCents)}</p>

      {!finished && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status === "PENDING" && (
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
          {item.status === "CONFIRMED" && (
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
