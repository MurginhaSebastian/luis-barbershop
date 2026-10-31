"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Barber, Product, Service } from "@/core/entities/catalog";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";
import type { BookingAction, BookingState } from "./booking-state";
import { choiceClass, legendClass } from "./styles";

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-card px-4 focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive";

/** Pasos 4–5: hora, datos y productos. Los campos son controlados para no perderlos si la reserva falla. */
export function ConfirmForm(props: {
  action: BookingAction;
  barber: Barber;
  services: Service[];
  products: Product[];
  slots: string[];
}) {
  const [state, formAction, pending] = useActionState<BookingState, FormData>(props.action, { status: "idle" });
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});

  const total =
    props.services.reduce((sum, s) => sum + s.priceCents, 0) +
    props.products.reduce((sum, p) => sum + p.priceCents * (qty[p.id] ?? 0), 0);

  if (state.status === "ok") {
    return (
      <section aria-live="polite" className="rounded-3xl border-2 border-primary/70 p-8 text-center">
        <h2 className="font-heading text-4xl text-primary">Reserva registrada</h2>
        <p className="mt-4 text-lg first-letter:uppercase">
          {formatLongDate(state.start)}, {formatTime(state.start)} con {props.barber.name}
        </p>
        <p className="mt-1 text-muted-foreground">
          {props.services.map((s) => s.name).join(", ")} · {formatPrice(state.totalCents)}
        </p>
        <p className="mx-auto mt-6 max-w-sm">
          Tu cita queda pendiente hasta que te escribamos por WhatsApp para confirmarla. Pagas en el local.
        </p>
        <Link href="/" className="mt-8 inline-block text-primary underline underline-offset-4">
          Volver al inicio
        </Link>
      </section>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="barberId" value={props.barber.id} />
      {props.services.map((s) => (
        <input key={s.id} type="hidden" name="serviceIds" value={s.id} />
      ))}

      <fieldset>
        <legend className={legendClass}>4. Hora</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {props.slots.map((iso) => (
            <label key={iso} className={`${choiceClass} justify-center tabular-nums`}>
              <input
                type="radio"
                name="start"
                value={iso}
                required
                checked={start === iso}
                onChange={() => setStart(iso)}
                className="sr-only"
              />
              {formatTime(iso)}
            </label>
          ))}
        </div>
        {errors.start && <p className="mt-2 text-sm text-destructive">{errors.start}</p>}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={legendClass}>5. Tus datos</legend>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm">
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
          {errors.name && <p id="name-error" className="mt-1.5 text-sm text-destructive">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm">
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
            aria-describedby={errors.phone ? "phone-error" : undefined}
            className={fieldClass}
          />
          {errors.phone && <p id="phone-error" className="mt-1.5 text-sm text-destructive">{errors.phone}</p>}
        </div>
      </fieldset>

      {props.products.length > 0 && (
        <fieldset>
          <legend className="mb-1 font-heading text-2xl">¿Te llevas algo?</legend>
          <p className="mb-4 text-sm text-muted-foreground">Te lo tenemos listo en tu cita y lo pagas allí.</p>
          <ul className="space-y-2">
            {props.products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                <label htmlFor={`qty-${p.id}`} className="flex-1">
                  {p.name}
                </label>
                <span className="text-sm text-muted-foreground tabular-nums">{formatPrice(p.priceCents)}</span>
                <select
                  id={`qty-${p.id}`}
                  name={`qty:${p.id}`}
                  value={qty[p.id] ?? 0}
                  onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })}
                  className="h-9 rounded-lg border border-input bg-card px-2"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p>
          Total estimado <span className="ml-2 font-heading text-2xl text-primary tabular-nums">{formatPrice(total)}</span>
        </p>
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-full bg-primary px-8 font-semibold text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Reservando…" : "Reservar cita"}
        </button>
      </div>
      <p aria-live="polite" className="text-destructive">
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
