"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { expiryLabel } from "@/presentation/lib/expiry";
import { formatLongDate, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { AppointmentActions, type ChangeStatusAction } from "./appointment-actions";
import { STATUS } from "./appointment-status";

/** Citas por confirmar o en riesgo, de cualquier día: se atienden aquí o se abre su ficha. Al pie, lo que se pase en `children`. */
export function PendingColumn(props: { items: AgendaItem[]; changeStatus: ChangeStatusAction; onOpen: (id: string, anchor?: HTMLElement) => void; children?: ReactNode }) {
  const items = [...props.items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const [now, setNow] = useState<number>();
  useEffect(() => {
    // Tras montar, para que servidor y cliente pinten lo mismo al hidratar.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-gutter-md rounded-md border border-light-outline bg-light-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pendientes" className="font-title text-title-md">
          Pendientes / En riesgo
        </h2>
        <span className="rounded-sm bg-status-risk-bg px-2 py-0.5 font-label text-label-sm text-status-risk-text tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-body-md text-light-muted">Nada por confirmar.</p>
      ) : (
        <ul className="flex flex-col gap-gutter-sm">
          {items.map((item) => {
            const expiry = now === undefined ? null : expiryLabel(item, now);
            return (
              <li key={item.id} className={cn("rounded-sm border p-3", STATUS[item.status].badge)}>
                <button
                  type="button"
                  aria-label={`Ver la cita de ${item.customerName}`}
                  onClick={(event) => props.onOpen(item.id, event.currentTarget)}
                  className="block min-h-11 w-full cursor-pointer rounded-sm text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <strong className="min-w-0 truncate font-title text-title-md">
                      <span className="tabular-nums">{formatTime(item.start)}</span> {item.customerName}
                    </strong>
                    {expiry && <span className="shrink-0 font-label text-label-sm tabular-nums">{expiry}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-body-md">
                    <span className="first-letter:uppercase">{formatLongDate(item.start)}</span> · {item.services.join(", ")} · {item.barberName}
                  </span>
                  <span className="block text-label-sm font-semibold uppercase">{STATUS[item.status].short}</span>
                </button>
                <AppointmentActions item={item} changeStatus={props.changeStatus} compact />
              </li>
            );
          })}
        </ul>
      )}
      {props.children}
    </div>
  );
}
