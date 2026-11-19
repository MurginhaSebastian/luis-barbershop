import type { Agenda } from "@/application/use-cases/agenda/get-agenda";
import type { ChangeStatusAction } from "./appointment-actions";
import { AgendaCalendar } from "./agenda-calendar";

/** El calendario; lo que espera respuesta, de cualquier día, va en la píldora "Por confirmar" de su barra. */
export function AgendaView(props: { agenda: Agenda; date: string; today: string; changeStatus: ChangeStatusAction }) {
  return (
    <div className="mt-6">
      <section aria-labelledby="agenda-dia">
        <AgendaCalendar agenda={props.agenda} date={props.date} today={props.today} changeStatus={props.changeStatus} />
      </section>
    </div>
  );
}
