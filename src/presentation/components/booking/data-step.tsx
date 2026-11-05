"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useState } from "react";
import type { Barber, Product, Service } from "@/core/entities/catalog";
import { bookingHref, type BookingSelection } from "@/presentation/lib/booking-flow";
import { formatPrice } from "@/presentation/lib/format";
import { BookingConfirmation } from "./booking-confirmation";
import { BookingSummary } from "./booking-summary";
import type { BookingAction, BookingState } from "./booking-state";
import { StepLayout } from "./step-layout";
import { primaryButtonClass } from "./styles";

const MAX_PER_PRODUCT = 3;
const fieldClass =
  "h-12 w-full rounded-xl border border-input bg-card px-4 focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";
const stepperClass =
  "grid size-11 cursor-pointer place-items-center rounded-full border border-input transition-colors duration-200 hover:border-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary";

/** Paso 4: datos y productos. Los campos son controlados para no perderlos si la reserva falla. */
export function DataStep(props: {
  progress: ReactNode;
  action: BookingAction;
  selection: BookingSelection & { barbero: string; hora: string };
  services: Service[];
  products: Product[];
  barbers: Barber[];
  barberName: string;
}) {
  const [state, formAction, pending] = useActionState<BookingState, FormData>(props.action, { status: "idle" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});

  // Sin esto, recargar tras reservar volvería a una hora que ya está ocupada por esta misma cita.
  const booked = state.status === "ok";
  useEffect(() => {
    if (booked) window.history.replaceState(null, "", "/reservar");
  }, [booked]);

  if (state.status === "ok") {
    return (
      <BookingConfirmation
        start={state.start}
        barberName={props.barbers.find((b) => b.id === state.barberId)?.name ?? props.barberName}
        services={props.services.map((s) => s.name)}
        totalCents={state.totalCents}
      />
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const extraCents = props.products.reduce((sum, p) => sum + p.priceCents * (qty[p.id] ?? 0), 0);
  const change = (id: string, delta: number) => setQty((q) => ({ ...q, [id]: (q[id] ?? 0) + delta }));

  return (
    <StepLayout
      progress={props.progress}
      title="Tus datos"
      backHref={bookingHref(3, { ...props.selection, hora: undefined })}
      summary={
        <BookingSummary
          services={props.services}
          barberName={props.barberName}
          hora={props.selection.hora}
          extraCents={extraCents}
        />
      }
    >
      <form action={formAction} className="space-y-8">
        <input type="hidden" name="barberId" value={props.selection.barbero} />
        <input type="hidden" name="start" value={props.selection.hora} />
        {props.services.map((s) => (
          <input key={s.id} type="hidden" name="serviceIds" value={s.id} />
        ))}

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className={fieldClass}
            />
            {errors.name && (
              <p id="name-error" className="mt-1.5 text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block">
              Celular (WhatsApp)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="9xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
              className={fieldClass}
            />
            {errors.phone ? (
              <p id="phone-error" className="mt-1.5 text-sm text-destructive">
                {errors.phone}
              </p>
            ) : (
              <p id="phone-hint" className="mt-1.5 text-sm text-muted-foreground">
                Te escribiremos aquí para confirmar tu cita.
              </p>
            )}
          </div>
        </div>

        {props.products.length > 0 && (
          <fieldset>
            <legend className="font-heading text-2xl">¿Te llevas algo?</legend>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Opcional. Te lo tenemos listo y lo pagas en tu cita.</p>
            <ul className="space-y-2">
              {props.products.map((p) => {
                const count = qty[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-2">
                    <span className="flex-1">
                      <span className="block">{p.name}</span>
                      <span className="block text-sm tabular-nums text-muted-foreground">{formatPrice(p.priceCents)}</span>
                    </span>
                    <input type="hidden" name={`qty:${p.id}`} value={count} />
                    <button
                      type="button"
                      aria-label={`Quitar ${p.name}`}
                      disabled={count === 0}
                      onClick={() => change(p.id, -1)}
                      className={stepperClass}
                    >
                      <Minus aria-hidden className="size-4" />
                    </button>
                    <output aria-live="polite" aria-label={`Cantidad de ${p.name}`} className="w-5 text-center tabular-nums">
                      {count}
                    </output>
                    <button
                      type="button"
                      aria-label={`Añadir ${p.name}`}
                      disabled={count === MAX_PER_PRODUCT}
                      onClick={() => change(p.id, 1)}
                      className={stepperClass}
                    >
                      <Plus aria-hidden className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-xl border border-destructive/60 px-4 py-3 text-destructive">
            <p>{state.message}</p>
            {state.slotTaken && (
              <Link
                href={bookingHref(3, { ...props.selection, hora: undefined })}
                className="mt-1 inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Elegir otra hora
              </Link>
            )}
          </div>
        )}

        <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-auto`}>
          {pending ? "Reservando…" : "Reservar cita"}
        </button>
      </form>
    </StepLayout>
  );
}
