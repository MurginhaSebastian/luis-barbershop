"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { AgendaCard, type ChangeStatusAction } from "./agenda-card";

/** Ficha de una cita: `<dialog>` nativo (foco atrapado, Esc y retorno del foco los pone el navegador). */
export function AppointmentDialog(props: { item?: AgendaItem; onClose: () => void; changeStatus: ChangeStatusAction }) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = Boolean(props.item);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // El clic en el fondo es un atajo de ratón: el teclado cierra con Esc y con el botón X.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby="ficha-titulo"
      onClose={props.onClose}
      onClick={(event) => event.target === ref.current && ref.current.close()}
      className="m-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-cal-accent bg-cal-surface p-0 text-foreground shadow-2xl shadow-black backdrop:bg-black/60 max-sm:mt-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none"
    >
      {props.item && (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 id="ficha-titulo" className="font-heading text-xl">
              Cita de {props.item.customerName}
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => ref.current?.close()}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cal-line hover:border-cal-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <AgendaCard item={props.item} showDate changeStatus={props.changeStatus} />
        </div>
      )}
    </dialog>
  );
}
