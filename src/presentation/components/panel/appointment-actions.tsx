"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { cn } from "@/presentation/lib/utils";
import { cancellationMessage, confirmationMessage, contactMessage, whatsappLink } from "@/presentation/lib/whatsapp";

export type ChangeStatusAction = (id: string, status: AppointmentStatus) => Promise<{ error?: string }>;

const action =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors duration-200 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-accent";
const primary = `${action} bg-cal-accent font-semibold text-cal-canvas hover:bg-cal-pending-text`;
const secondary = `${action} border border-cal-line hover:border-cal-accent`;
const quiet = `${action} text-cal-done-text underline-offset-2 hover:text-cal-text hover:underline`;

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
    <div className={cn(!props.compact && "mt-4")}>
      <div className="flex flex-wrap gap-2">
        {status !== "CONFIRMED" && (
          <button type="button" disabled={pending} className={primary} onClick={() => change("CONFIRMED")}>
            Confirmar cita
          </button>
        )}
        <a
          href={whatsappLink(item.phone, status === "CONFIRMED" ? confirmationMessage(item) : contactMessage(item))}
          target="_blank"
          rel="noopener noreferrer"
          className={secondary}
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
        <button type="button" disabled={pending} className={quiet} onClick={cancel}>
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
