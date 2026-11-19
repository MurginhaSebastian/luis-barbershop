"use client";

import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { formatLongDate, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { AppointmentActions, type ChangeStatusAction } from "./appointment-actions";
import { STATUS } from "./appointment-status";

/** Citas por confirmar o en riesgo, de cualquier día: se atienden aquí o se abre su ficha. */
export function PendingColumn(props: { items: AgendaItem[]; changeStatus: ChangeStatusAction; onOpen: (id: string, anchor?: HTMLElement) => void }) {
  const items = [...props.items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pendientes" className="font-heading text-2xl">
          Pendientes / En riesgo
        </h2>
        <span className="text-sm tabular-nums text-cal-done-text">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-cal-done-text">Nada por confirmar.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-cal-line bg-cal-surface p-2">
              <button
                type="button"
                aria-label={`Ver la cita de ${item.customerName}`}
                onClick={(event) => props.onOpen(item.id, event.currentTarget)}
                className="block min-h-11 w-full cursor-pointer rounded-lg p-1 text-left text-sm transition-colors duration-200 hover:bg-cal-line/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cal-accent"
              >
                <span className="block text-cal-done-text">
                  <span className="first-letter:uppercase">{formatLongDate(item.start)}</span> · <span className="tabular-nums">{formatTime(item.start)}</span>
                </span>
                <strong className="block truncate text-base">{item.customerName}</strong>
                <span className="block truncate text-cal-done-text">{item.services.join(", ")}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-cal-pending-text">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", item.status === "AT_RISK" ? "border border-dashed border-cal-accent" : "bg-cal-accent/45")}
                  />
                  {STATUS[item.status].short}
                </span>
              </button>
              <AppointmentActions item={item} changeStatus={props.changeStatus} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
