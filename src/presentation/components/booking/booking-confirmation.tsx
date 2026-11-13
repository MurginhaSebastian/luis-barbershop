"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import { ctaClass, ghostCtaClass } from "@/presentation/components/landing/styles";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import type { BookingState } from "./booking-state";

type Confirmation = NonNullable<Extract<BookingState, { status: "ok" }>["confirmation"]>;

/** Cierre del flujo: el foco va al título para que el lector de pantalla anuncie el resultado. */
export function BookingConfirmation(props: {
  start: string;
  barberName: string;
  services: string[];
  totalCents: number;
  confirmation?: Confirmation;
}) {
  const { confirmation } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <section className="mx-auto mt-8 max-w-lg rounded-3xl border-2 border-primary/70 p-8 text-center">
      <CheckCircle2 aria-hidden className="mx-auto size-12 text-primary" />
      <h2 ref={heading} tabIndex={-1} className="mt-4 font-heading text-4xl text-primary outline-none">
        Reserva registrada
      </h2>
      <dl className="mt-6 space-y-1 text-lg">
        <div>
          <dt className="sr-only">Fecha y hora</dt>
          <dd className="first-letter:uppercase">
            {formatLongDate(props.start)}, {formatTime(props.start)}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Barbero</dt>
          <dd>Con {props.barberName}</dd>
        </div>
        <div>
          <dt className="sr-only">Servicios y total</dt>
          <dd className="text-muted-foreground">
            {props.services.join(", ")}: <span className="tabular-nums text-primary">{formatPrice(props.totalCents)}</span>
          </dd>
        </div>
      </dl>
      {confirmation ? (
        <>
          <p className="mx-auto mt-6 max-w-sm leading-relaxed">
            <strong className="text-foreground">Confírmala por WhatsApp {deadline(confirmation.confirmBy)}.</strong> Si no,
            la hora se libera para otro cliente. Pagas en el local.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu código: <span className="font-semibold tracking-widest text-foreground">{confirmation.code}</span>
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <a
              href={whatsappLink(confirmation.whatsapp, `Confirmo mi cita ${confirmation.code}`)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ctaClass} gap-2`}
            >
              <MessageCircle aria-hidden className="size-5" />
              Confirmar por WhatsApp
            </a>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/" className={ghostCtaClass}>
                Volver al inicio
              </Link>
              <Link href="/reservar" className={ghostCtaClass}>
                Reservar otra cita
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mx-auto mt-6 max-w-sm leading-relaxed">
            Tu cita queda pendiente hasta que te escribamos por WhatsApp para confirmarla. Pagas en el local.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className={ctaClass}>
              Volver al inicio
            </Link>
            <Link href="/reservar" className={ghostCtaClass}>
              Reservar otra cita
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/** "antes de las 12:00" si es hoy; si el plazo pasa de medianoche, también el día. */
function deadline(iso: string): string {
  const sameDay = formatLongDate(iso) === formatLongDate(new Date());
  return sameDay ? `antes de las ${formatTime(iso)}` : `antes del ${formatLongDate(iso)} a las ${formatTime(iso)}`;
}
