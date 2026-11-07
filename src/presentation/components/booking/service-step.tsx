"use client";

import Form from "next/form";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Service } from "@/core/entities/catalog";
import type { BookingSelection } from "@/presentation/lib/booking-flow";
import { formatPrice } from "@/presentation/lib/format";
import { BookingSummary } from "./booking-summary";
import { StepLayout } from "./step-layout";
import { choiceClass } from "./styles";
import { SubmitButton } from "./submit-button";

/** Paso 1: elegir uno o varios servicios, viendo el total mientras se marcan. */
export function ServiceStep(props: { progress: ReactNode; services: Service[]; selection: BookingSelection }) {
  const form = useRef<HTMLFormElement>(null);
  const [chosen, setChosen] = useState(props.selection.servicios);
  const readForm = () => {
    if (form.current) setChosen(new FormData(form.current).getAll("servicios").map(String));
  };
  // Lo marcado antes de que cargue el JavaScript no pasa por React: se lee del formulario al arrancar.
  useEffect(readForm, []);
  const sorted = props.services.toSorted((a, b) => b.priceCents - a.priceCents);
  return (
    <StepLayout
      progress={props.progress}
      title="¿Qué servicio quieres?"
      summary={<BookingSummary services={sorted.filter((s) => chosen.includes(s.id))} />}
    >
      <Form ref={form} action="/reservar" onChange={readForm} className="space-y-6">
        <input type="hidden" name="paso" value="2" />
        {props.selection.barbero && <input type="hidden" name="barbero" value={props.selection.barbero} />}
        {props.selection.dia && <input type="hidden" name="dia" value={props.selection.dia} />}

        <fieldset>
          <legend className="mb-3 text-muted-foreground">Puedes elegir varios, por ejemplo corte y barba.</legend>
          <div className="grid gap-2">
            {sorted.map((s) => (
              <label key={s.id} className={`${choiceClass} min-h-16`}>
                <input
                  type="checkbox"
                  name="servicios"
                  value={s.id}
                  defaultChecked={props.selection.servicios.includes(s.id)}
                  className="size-5 accent-primary"
                />
                <span className="flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.durationMinutes} min</span>
                </span>
                <span className="tabular-nums text-primary">{formatPrice(s.priceCents)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <SubmitButton pendingLabel="Cargando…" disabled={chosen.length === 0}>
          Continuar
        </SubmitButton>
      </Form>
    </StepLayout>
  );
}
