"use client";

import { useActionState, useState } from "react";
import type { BusinessHours } from "@/core/scheduling/availability";
import { formatMinuteOfDay, WEEKDAYS } from "@/presentation/lib/format";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelField, panelSave } from "./form-status";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["open1", "close1", "open2", "close2"] as const;
const LABELS = { open1: "Abre", close1: "Cierra", open2: "Abre (2.º tramo)", close2: "Cierra (2.º tramo)" };

function DayForm(props: { weekday: number; hours: BusinessHours[]; action: AdminAction }) {
  const [first, second] = props.hours;
  const time = (minute?: number) => (minute === undefined ? "" : formatMinuteOfDay(minute));
  const [values, setValues] = useState({
    open1: time(first?.openMinute),
    close1: time(first?.closeMinute),
    open2: time(second?.openMinute),
    close2: time(second?.closeMinute),
  });
  const [state, formAction, pending] = useActionState<AdminState, FormData>(props.action, {});
  const day = WEEKDAYS[props.weekday];
  const closed = NAMES.every((name) => !values[name]);

  return (
    <form action={formAction} aria-label={day} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="weekday" value={props.weekday} />
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-xl">{day}</h3>
        {closed && <span className="text-sm text-muted-foreground">Cerrado</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {NAMES.map((name) => (
          <div key={name}>
            <label htmlFor={`${props.weekday}-${name}`} className="mb-1 block text-sm">
              {LABELS[name]}
            </label>
            <input
              id={`${props.weekday}-${name}`}
              name={name}
              type="time"
              value={values[name]}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
              className={panelField}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={panelSave}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

/** Horario común de la barbería, día por día. Sin horas, el día queda cerrado. */
export function HoursEditor({ weeklyHours, action }: { weeklyHours: BusinessHours[][]; action: AdminAction }) {
  return (
    <div className="mt-4 space-y-3">
      {MONDAY_FIRST.map((weekday) => (
        <DayForm key={weekday} weekday={weekday} hours={weeklyHours[weekday] ?? []} action={action} />
      ))}
    </div>
  );
}
