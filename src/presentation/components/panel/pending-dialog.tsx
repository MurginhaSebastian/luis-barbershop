"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { formatLongDate, formatTime } from "@/presentation/lib/format";

/** Lista corta de las citas sin confirmar de cualquier día; tocar una abre su ficha. */
export function PendingDialog(props: { open: boolean; items: AgendaItem[]; onClose: () => void; onPick: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { open } = props;

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
      aria-labelledby="pendientes-titulo"
      onClose={props.onClose}
      onClick={(event) => event.target === ref.current && ref.current.close()}
      className="m-auto max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-cal-accent bg-cal-surface p-0 text-foreground shadow-2xl shadow-black backdrop:bg-black/60 max-sm:mt-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 id="pendientes-titulo" className="font-heading text-xl">
            Por confirmar
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
        <ul className="space-y-1">
          {props.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => props.onPick(item.id)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-cal-line px-3 text-left text-sm hover:border-cal-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cal-accent"
              >
                <span className="first-letter:uppercase text-cal-done-text">{formatLongDate(item.start)}</span>
                <span className="tabular-nums font-semibold">{formatTime(item.start)}</span>
                <strong className="min-w-0 truncate">{item.customerName}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
