import type { Agenda } from "@/application/use-cases/agenda/get-agenda";
import { AgendaCard, type ChangeStatusAction } from "./agenda-card";
import { AgendaCalendar } from "./agenda-calendar";

/** Arriba lo que espera respuesta, de cualquier día; debajo la agenda del día elegido. */
export function AgendaView(props: { agenda: Agenda; date: string; today: string; changeStatus: ChangeStatusAction }) {
  const { pending } = props.agenda;
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
        <AgendaCalendar agenda={props.agenda} date={props.date} today={props.today} changeStatus={props.changeStatus} />
      </section>
    </div>
  );
}
