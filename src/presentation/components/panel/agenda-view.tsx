import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Agenda } from "@/application/use-cases/agenda/get-agenda";
import { shiftDay } from "@/presentation/lib/days";
import { formatLongDate } from "@/presentation/lib/format";
import { AgendaCard, type ChangeStatusAction } from "./agenda-card";

const dayLink =
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-input px-3 text-sm transition-colors duration-200 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Arriba lo que espera respuesta, de cualquier día; debajo la agenda del día elegido. */
export function AgendaView(props: { agenda: Agenda; date: string; today: string; changeStatus: ChangeStatusAction }) {
  const { pending, day } = props.agenda;
  const href = (date: string) => `/panel?dia=${date}`;
  return (
    <div className="mt-6 space-y-10">
      <section aria-labelledby="por-confirmar">
        <h2 id="por-confirmar" className="font-heading text-3xl">
          Por confirmar{pending.length > 0 && <span className="text-primary"> ({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Todas las citas están respondidas.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((item) => (
              <li key={item.id}>
                <AgendaCard item={item} showDate changeStatus={props.changeStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="agenda-dia">
        <h2 id="agenda-dia" className="font-heading text-3xl first-letter:uppercase">
          {props.date === props.today ? "Hoy" : formatLongDate(`${props.date}T12:00:00-05:00`)}
        </h2>
        <nav aria-label="Cambiar de día" className="mt-3 flex items-center gap-2">
          <Link href={href(shiftDay(props.date, -1))} aria-label="Día anterior" className={dayLink}>
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          {props.date !== props.today && (
            <Link href={href(props.today)} className={dayLink}>
              Hoy
            </Link>
          )}
          <Link href={href(shiftDay(props.date, 1))} aria-label="Día siguiente" className={dayLink}>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
        {day.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No hay citas este día.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {day.map((item) => (
              <li key={item.id}>
                <AgendaCard item={item} changeStatus={props.changeStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
