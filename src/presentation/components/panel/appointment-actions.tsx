"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { cn } from "@/presentation/lib/utils";
import { cancellationMessage, confirmationMessage, contactMessage, whatsappLink } from "@/presentation/lib/whatsapp";

export type ChangeStatusAction = (id: string, status: AppointmentStatus) => Promise<{ error?: string }>;

const action =
  "inline-flex cursor-pointer items-center justify-center gap-gutter-xs rounded-sm px-3 font-label transition-colors duration-150 motion-reduce:transition-none disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light";
const primary = `${action} bg-gold text-on-gold hover:opacity-90`;
const secondary = `${action} border border-light-outline bg-light-canvas text-on-light-card hover:border-gold-on-light`;
const danger = `${action} border border-destructive-border bg-light-card text-destructive-text hover:bg-status-risk-bg`;

/** Las acciones que el estado de la cita permite; las comparten la ficha y la columna de pendientes. */
export function AppointmentActions(props: { item: AgendaItem; changeStatus: ChangeStatusAction; compact?: boolean }) {
  const { item } = props;
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { status } = item;
  if (status !== "PENDING" && status !== "CONFIRMED" && status !== "AT_RISK") return null;

  const change = (next: AppointmentStatus, message?: string) => {
    // Se abre aquí, durante el toque: después del await el navegador lo bloquearía.
    if (message) window.open(whatsappLink(item.phone, message), "_blank", "noopener");
    startTransition(async () => setError((await props.changeStatus(item.id, next)).error));
  };

  const cancel = () => {
    if (window.confirm(`¿Cancelar la cita de ${item.customerName}? Se abrirá WhatsApp para avisarle.`)) {
      change("CANCELLED", cancellationMessage(item));
    }
  };

  return (
    <div className={props.compact ? "mt-2" : "mt-4 border-t border-light-outline pt-4"}>
      <div className={props.compact ? "flex flex-wrap gap-2 [&>*]:min-h-9 [&>*]:text-label-sm" : "grid grid-cols-2 gap-2 [&>*]:min-h-11 [&>*]:text-label-lg"}>
        {status !== "CONFIRMED" && (
          <button type="button" disabled={pending} className={cn(primary, "col-span-2")} onClick={() => change("CONFIRMED")}>
            Confirmar cita
          </button>
        )}
        <a
          href={whatsappLink(item.phone, status === "CONFIRMED" ? confirmationMessage(item) : contactMessage(item))}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(secondary, "col-span-2")}
        >
          <MessageCircle aria-hidden className="size-4" />
          Enviar WhatsApp
        </a>
        {status !== "PENDING" && (
          <>
            <button type="button" disabled={pending} className={secondary} onClick={() => change("COMPLETED")}>
              Atendida
            </button>
            <button type="button" disabled={pending} className={secondary} onClick={() => change("NO_SHOW")}>
              No vino
            </button>
          </>
        )}
        <button type="button" disabled={pending} className={cn(danger, "col-span-2")} onClick={cancel}>
          Cancelar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
