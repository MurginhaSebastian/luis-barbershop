"use client";

import { X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { AppointmentActions, type ChangeStatusAction } from "./appointment-actions";
import { STATUS } from "./appointment-status";

const GAP = 8;

/** Junto a la cita (a la derecha si cabe, si no a la izquierda) y siempre dentro de la pantalla. */
function placeBeside(dialog: HTMLDialogElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const [w, h] = [dialog.offsetWidth, dialog.offsetHeight];
  const right = rect.right + GAP;
  const left = right + w <= innerWidth - GAP ? right : rect.left - GAP - w;
  dialog.style.inset = "auto";
  dialog.style.margin = "0";
  dialog.style.left = `${Math.max(GAP, Math.min(left, innerWidth - w - GAP))}px`;
  dialog.style.top = `${Math.max(GAP, Math.min(rect.top, innerHeight - h - GAP))}px`;
}

/**
 * Ficha de una cita: `<dialog>` nativo (foco atrapado, Esc y retorno del foco los pone el navegador).
 * En escritorio se abre junto a la cita; en el móvil es una hoja inferior.
 */
export function AppointmentDialog(props: { item?: AgendaItem; anchor?: HTMLElement; onClose: () => void; changeStatus: ChangeStatusAction }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { item, anchor } = props;
  const id = item?.id;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (id && !dialog.open) dialog.showModal();
    if (!id && dialog.open) dialog.close();
    dialog.removeAttribute("style");
    if (id && anchor?.isConnected && matchMedia("(min-width: 640px)").matches) placeBeside(dialog, anchor);
  }, [id, anchor]);

  const minutes = item ? Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60_000) : 0;
  const finished = item?.status !== "PENDING" && item?.status !== "CONFIRMED" && item?.status !== "AT_RISK";

  return (
    // El clic en el fondo es un atajo de ratón: el teclado cierra con Esc y con el botón X.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby="ficha-titulo"
      onClose={props.onClose}
      onClick={(event) => event.target === ref.current && ref.current.close()}
      className="m-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-cal-accent bg-cal-surface p-0 text-foreground shadow-2xl shadow-black backdrop:bg-black/60 max-sm:mt-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none"
    >
      {item && (
        <article aria-label={`${formatTime(item.start)}, ${item.customerName}`} className={cn("p-4 wrap-anywhere", finished && "opacity-80")}>
          <div className="flex items-start justify-between gap-2">
            <h2 id="ficha-titulo" className="font-heading text-2xl">
              Cita de {item.customerName}
            </h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => ref.current?.close()}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cal-line transition-colors duration-200 hover:border-cal-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-accent"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <span className={cn("mt-1 inline-block rounded-full border px-3 py-1 text-xs font-semibold", STATUS[item.status].badge)}>
            {STATUS[item.status].label}
          </span>
          <p className="mt-3 first-letter:uppercase">
            {formatLongDate(item.start)} · <span className="tabular-nums">{formatTime(item.start)} – {formatTime(item.end)}</span> ({minutes} min)
          </p>
          {item.phone && (
            <p className="text-sm tabular-nums">
              <a href={`tel:+${item.phone}`} className="underline underline-offset-2 hover:text-primary">
                +{item.phone}
              </a>
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {item.services.join(", ")} con {item.barberName} · <span className="tabular-nums text-cal-accent">{formatPrice(item.totalCents)}</span>
          </p>
          {item.products.length > 0 && <p className="text-sm text-muted-foreground">Para llevar: {item.products.join(", ")}</p>}
          {item.status === "PENDING" && item.confirmBy && (
            <p className="mt-2 text-sm text-muted-foreground">
              El cliente puede confirmar por WhatsApp hasta las {formatTime(item.confirmBy)}; después, otro cliente puede tomar la hora.
            </p>
          )}
          {item.status === "AT_RISK" && (
            <p className="mt-2 text-sm text-muted-foreground">
              No confirmó a tiempo: otro cliente puede reservar esta hora. Si llega o te avisa, confírmala o márcala atendida.
            </p>
          )}
          <AppointmentActions item={item} changeStatus={props.changeStatus} />
        </article>
      )}
    </dialog>
  );
}
