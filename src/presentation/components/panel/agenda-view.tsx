"use client";

import { useState, type ReactNode } from "react";
import type { Agenda } from "@/application/use-cases/agenda/get-agenda";
import { AgendaCalendar } from "./agenda-calendar";
import { AppointmentDialog } from "./appointment-dialog";
import type { ChangeStatusAction } from "./appointment-actions";
import { PendingColumn } from "./pending-column";

/** Calendario a la izquierda; a su lado, lo que espera respuesta (de cualquier día) y los avisos (`extra`). */
export function AgendaView(props: { agenda: Agenda; date: string; today: string; changeStatus: ChangeStatusAction; extra?: ReactNode }) {
  const { agenda } = props;
  const [selected, setSelected] = useState<{ id: string; anchor?: HTMLElement } | null>(null);
  const open = (id: string, anchor?: HTMLElement) => setSelected({ id, anchor });
  // Una cita por confirmar puede caer fuera del rango visible.
  const item = agenda.items.find((i) => i.id === selected?.id) ?? agenda.pending.find((i) => i.id === selected?.id);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section aria-labelledby="agenda-dia" className="min-w-0">
        <AgendaCalendar agenda={agenda} date={props.date} today={props.today} onOpen={open} />
      </section>
      <aside aria-labelledby="pendientes" className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <PendingColumn items={agenda.pending} changeStatus={props.changeStatus} onOpen={open} />
        {props.extra && <div className="mt-6">{props.extra}</div>}
      </aside>
      <AppointmentDialog item={item} anchor={selected?.anchor} onClose={() => setSelected(null)} changeStatus={props.changeStatus} />
    </div>
  );
}
