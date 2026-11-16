"use client";

import { useState } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { formatTime } from "@/presentation/lib/format";
import { blockHeight, dayTimeline, gapHeight, isOperational } from "@/presentation/lib/timeline";
import { cn } from "@/presentation/lib/utils";
import { AgendaCard, type ChangeStatusAction } from "./agenda-card";

const filterClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input px-4 text-sm transition-colors duration-200 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground";

/**
 * La agenda de un día como línea de tiempo: cada cita mide según su duración y las que se cruzan se apilan en su
 * franja. Con varios barberos, un filtro (botones con aria-pressed, sin scroll horizontal en 320 px).
 */
export function AgendaDay(props: { items: AgendaItem[]; changeStatus: ChangeStatusAction }) {
  const barbers = [...new Set(props.items.map((i) => i.barberName))];
  const [chosen, setChosen] = useState<string | null>(null);
  // Al cambiar de día, un barbero sin citas ese día vuelve a "Todos".
  const barber = chosen && barbers.includes(chosen) ? chosen : null;
  const shown = props.items.filter((i) => !barber || i.barberName === barber);
  const rows = dayTimeline(shown.filter((i) => isOperational(i.status)));
  const closed = shown.filter((i) => !isOperational(i.status));

  return (
    <>
      {barbers.length > 1 && (
        <div role="group" aria-label="Ver la agenda de" className="mt-4 flex flex-wrap gap-2">
          {[null, ...barbers].map((name) => (
            <button key={name ?? ""} type="button" aria-pressed={barber === name} onClick={() => setChosen(name)} className={filterClass}>
              {name ?? "Todos"}
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <ol aria-label="Línea de tiempo del día" className="mt-4 space-y-2">
          {rows.map((row) =>
            row.kind === "gap" ? (
              <li
                key={`libre-${row.start}`}
                style={{ minHeight: gapHeight(row.minutes) }}
                className="flex items-center border-l-2 border-dashed border-border pl-3 text-sm text-muted-foreground sm:ml-16"
              >
                Libre {formatTime(row.start)} – {formatTime(row.end)} · {row.minutes} min
              </li>
            ) : (
              <li key={row.start} className="sm:grid sm:grid-cols-[3.5rem_1fr] sm:gap-2">
                {/* En el móvil sobra: cada cita ya muestra su rango. */}
                <time dateTime={row.start} className="hidden pt-4 text-sm tabular-nums text-muted-foreground sm:block">
                  {formatTime(row.start)}
                </time>
                <ul className="space-y-2">
                  {row.items.map((item) => (
                    <li key={item.id} style={{ minHeight: blockHeight(item.start, item.end) }} className="flex flex-col">
                      <AgendaCard item={item} changeStatus={props.changeStatus} />
                    </li>
                  ))}
                </ul>
              </li>
            ),
          )}
        </ol>
      )}

      {closed.length > 0 && (
        <>
          <h3 className={cn("font-heading text-2xl", rows.length > 0 ? "mt-8" : "mt-4")}>Canceladas y vencidas</h3>
          <ul className="mt-3 space-y-3">
            {closed.map((item) => (
              <li key={item.id}>
                <AgendaCard item={item} changeStatus={props.changeStatus} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
