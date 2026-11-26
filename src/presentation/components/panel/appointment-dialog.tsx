"use client";

import { X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { AppointmentActions, type ChangeStatusAction } from "./appointment-actions";
import { STATUS } from "./appointment-status";

const DESKTOP = "(min-width: 1024px)";

/**
 * Ficha de una cita: un `<dialog>` nativo. En escritorio es no modal (`show()`) y ocupa su sitio en la columna derecha,
 * como "Cita seleccionada"; en el móvil es modal (`showModal()`, una hoja inferior con foco atrapado y fondo).
 */
export function AppointmentDialog(props: { item?: AgendaItem; anchor?: HTMLElement; onClose: () => void; changeStatus: ChangeStatusAction }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { item, anchor } = props;
  const id = item?.id;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (id && !dialog.open) {
      if (matchMedia(DESKTOP).matches) dialog.show();
      else dialog.showModal();
    }
    if (!id && dialog.open) dialog.close();
  }, [id, anchor]);

  const minutes = item ? Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60_000) : 0;
  const finished = item?.status !== "PENDING" && item?.status !== "CONFIRMED" && item?.status !== "AT_RISK";

  const close = () => {
    ref.current?.close();
    // El modal devuelve el foco solo; el no modal no.
    if (anchor?.isConnected) anchor.focus();
  };

  return (
    // El clic en el fondo es un atajo de ratón: el teclado cierra con Esc y con el botón X.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={item ? `Cita de ${item.customerName}` : undefined}
      onClose={props.onClose}
      onKeyDown={(event) => event.key === "Escape" && close()}
      onClick={(event) => event.target === ref.current && ref.current.close()}
      className="m-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-md border border-light-outline bg-light-card p-0 text-on-light-card shadow-2xl backdrop:bg-dark-canvas/60 max-lg:mt-auto max-lg:mb-0 max-lg:max-w-none max-lg:rounded-b-none lg:static lg:m-0 lg:max-h-none lg:max-w-none lg:overflow-visible lg:shadow-none"
    >
      {item && (
        <article aria-label={`${formatTime(item.start)}, ${item.customerName}`} className={cn("p-4 wrap-anywhere sm:p-5", finished && "opacity-90")}>
          <div className="flex items-start justify-between gap-2 border-b border-light-outline pb-3">
            <div className="min-w-0">
              <p className="font-eyebrow text-eyebrow text-gold-on-light uppercase">Cita seleccionada</p>
              <h2 className="font-headline text-headline-md leading-tight">{item.customerName}</h2>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={close}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-light-outline transition-colors duration-150 motion-reduce:transition-none hover:border-gold-on-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <span className={cn("mt-3 inline-block rounded-sm border px-2.5 py-1 font-label text-label-sm uppercase", STATUS[item.status].badge)}>
            {STATUS[item.status].label}
          </span>
          <p className="mt-3 first-letter:uppercase">
            {formatLongDate(item.start)} · <span className="tabular-nums">{formatTime(item.start)} – {formatTime(item.end)}</span> ({minutes} min)
          </p>
          {item.phone && (
            <p className="text-body-md tabular-nums">
              <a href={`tel:+${item.phone}`} className="underline underline-offset-2 hover:text-gold-on-light">
                +{item.phone}
              </a>
            </p>
          )}
          <p className="mt-1 text-body-md text-light-muted">
            {item.services.join(", ")} con {item.barberName} · <span className="font-semibold tabular-nums text-on-light-card">{formatPrice(item.totalCents)}</span>
          </p>
          {item.products.length > 0 && <p className="text-body-md text-light-muted">Para llevar: {item.products.join(", ")}</p>}
          {item.status === "PENDING" && item.confirmBy && (
            <p className="mt-2 text-body-md text-light-muted">
              El cliente puede confirmar por WhatsApp hasta las {formatTime(item.confirmBy)}; después, otro cliente puede tomar la hora.
            </p>
          )}
          {item.status === "AT_RISK" && (
            <p className="mt-2 text-body-md text-light-muted">
              No confirmó a tiempo: otro cliente puede reservar esta hora. Si llega o te avisa, confírmala o márcala atendida.
            </p>
          )}
          <AppointmentActions item={item} changeStatus={props.changeStatus} />
        </article>
      )}
    </dialog>
  );
}
