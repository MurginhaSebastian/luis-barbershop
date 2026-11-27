"use client";

import { useState, useTransition } from "react";
import type { BusinessHours } from "@/core/scheduling/availability";
import { formatMinuteOfDay, WEEKDAYS } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus } from "./form-status";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["open1", "close1", "open2", "close2"] as const;
type Name = (typeof NAMES)[number];
type Values = Record<Name, string>;
interface Day {
  open: boolean;
  values: Values;
}

const LABELS: Record<Name, string> = { open1: "Abre", close1: "Cierra", open2: "Abre (2.º tramo)", close2: "Cierra (2.º tramo)" };
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light";
const TIME_FIELD = cn(
  "h-10 w-full min-w-0 rounded-sm border border-light-outline bg-light-canvas px-2 text-sm text-on-light-card tabular-nums disabled:opacity-50",
  FOCUS,
);
const EMPTY: Values = { open1: "", close1: "", open2: "", close2: "" };

function toDay(hours: BusinessHours[]): Day {
  const [first, second] = hours;
  const time = (minute?: number) => (minute === undefined ? "" : formatMinuteOfDay(minute));
  return {
    open: hours.length > 0,
    values: { open1: time(first?.openMinute), close1: time(first?.closeMinute), open2: time(second?.openMinute), close2: time(second?.closeMinute) },
  };
}

/** Lo que se envía: un día cerrado va con todo vacío, que es lo que el servidor entiende por "Cerrado". */
const sent = (day: Day): Values => (day.open ? day.values : EMPTY);
const same = (a: Day, b: Day) => NAMES.every((n) => sent(a)[n] === sent(b)[n]);

function Switch(props: { checked: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={props.checked}
          aria-label={props.label}
          onChange={(e) => props.onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-flex size-full rounded-full border-2 border-transparent transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-on-light motion-reduce:transition-none",
            props.checked ? "bg-dark-canvas" : "bg-light-outline",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full transition-transform duration-150 motion-reduce:transition-none",
              props.checked ? "translate-x-5 bg-gold" : "translate-x-0 bg-light-card",
            )}
          />
        </span>
      </span>
      <span className={props.checked ? "" : "text-light-muted"} aria-hidden="true">
        {props.checked ? "Abierto" : "Cerrado"}
      </span>
    </label>
  );
}

/** Horario común de la barbería, una fila por día. Un solo botón guarda los días que cambiaron. */
export function HoursEditor({ weeklyHours, action }: { weeklyHours: BusinessHours[][]; action: AdminAction }) {
  const initial = Object.fromEntries(MONDAY_FIRST.map((d) => [d, toDay(weeklyHours[d] ?? [])]));
  const [days, setDays] = useState<Record<number, Day>>(initial);
  const [saved, setSaved] = useState<Record<number, Day>>(initial);
  // Lo escrito es del cliente: un error en un día no debe borrarlo al refrescar los datos del servidor.
  const [showSecond, setShowSecond] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(MONDAY_FIRST.map((d) => [d, (weeklyHours[d] ?? []).length > 1])),
  );
  const [states, setStates] = useState<Record<number, AdminState>>({});
  const [pending, startTransition] = useTransition();

  const dirty = MONDAY_FIRST.filter((d) => !same(days[d], saved[d]));
  const patch = (weekday: number, change: Partial<Day>) => setDays((all) => ({ ...all, [weekday]: { ...all[weekday], ...change } }));
  const setValue = (weekday: number, name: Name, value: string) => patch(weekday, { values: { ...days[weekday].values, [name]: value } });

  function saveAll() {
    if (dirty.length === 0) return;
    setStates({});
    startTransition(async () => {
      for (const weekday of dirty) {
        const form = new FormData();
        form.set("weekday", String(weekday));
        for (const name of NAMES) form.set(name, sent(days[weekday])[name]);
        const result = await action({}, form);
        setStates((all) => ({ ...all, [weekday]: result }));
        if (!result.error) setSaved((all) => ({ ...all, [weekday]: days[weekday] }));
      }
    });
  }

  return (
    <section aria-labelledby="horario-semanal" className="rounded-md border border-light-outline bg-light-card text-on-light-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-light-outline p-4 sm:px-6">
        <div>
          <h2 id="horario-semanal" className="text-lg font-semibold">
            Horario semanal
          </h2>
          <p className="text-sm text-light-muted">Común a todos los barberos: define los días de atención y el rango de horas disponible para reservas.</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={saveAll}
          className={cn(
            "inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-semibold text-on-gold transition-opacity duration-150 hover:opacity-90 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none",
            FOCUS,
          )}
        >
          {pending ? "Guardando…" : "Guardar horario"}
        </button>
      </div>
      <div className="divide-y divide-light-outline">
        {MONDAY_FIRST.map((weekday) => {
          const day = days[weekday];
          const second = showSecond[weekday];
          const field = (name: Name) => (
            <div key={name} className="min-w-0 flex-1 sm:max-w-32">
              <label htmlFor={`${weekday}-${name}`} className="mb-0.5 block text-xs text-light-muted">
                {LABELS[name]}
              </label>
              <input
                id={`${weekday}-${name}`}
                name={name}
                type="time"
                value={day.values[name]}
                disabled={!day.open}
                onChange={(e) => setValue(weekday, name, e.target.value)}
                className={TIME_FIELD}
              />
            </div>
          );
          return (
            <form
              key={weekday}
              aria-label={WEEKDAYS[weekday]}
              onSubmit={(e) => {
                e.preventDefault();
                saveAll();
              }}
              className="flex flex-wrap items-end gap-x-6 gap-y-3 p-4 sm:px-6"
            >
              <div className="flex w-full items-center justify-between gap-3 sm:w-72">
                <h3 className="text-base font-semibold">{WEEKDAYS[weekday]}</h3>
                <Switch
                  checked={day.open}
                  label={`Abierto: ${WEEKDAYS[weekday]}`}
                  onChange={(open) => {
                    // Al abrir un día sin horas se propone una jornada para no enviar un día vacío.
                    patch(weekday, { open, values: open && !day.values.open1 ? { ...day.values, open1: "09:00", close1: "18:00" } : day.values });
                  }}
                />
              </div>
              <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto sm:flex-1">
                <div className="flex w-full items-end gap-2 sm:w-auto">
                  {field("open1")}
                  <span aria-hidden="true" className="pb-2">
                    –
                  </span>
                  {field("close1")}
                </div>
                {second && (
                  <div className="flex w-full items-end gap-2 sm:w-auto">
                    {field("open2")}
                    <span aria-hidden="true" className="pb-2">
                      –
                    </span>
                    {field("close2")}
                  </div>
                )}
                {day.open && (
                  <button
                    type="button"
                    onClick={() => {
                      if (second) patch(weekday, { values: { ...day.values, open2: "", close2: "" } });
                      setShowSecond({ ...showSecond, [weekday]: !second });
                    }}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-sm border border-light-outline bg-light-canvas px-3 text-sm font-semibold transition-colors duration-150 hover:border-gold-on-light motion-reduce:transition-none",
                      FOCUS,
                    )}
                  >
                    {second ? "Quitar pausa" : "+ Pausa"}
                  </button>
                )}
              </div>
              <div className="w-full">
                <FormStatus state={states[weekday] ?? {}} />
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
