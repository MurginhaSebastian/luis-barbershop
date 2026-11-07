"use client";

import { useActionState, useState, useTransition } from "react";
import type { BlockItem } from "@/application/use-cases/admin/manage-schedule";
import type { Barber } from "@/core/entities/catalog";
import { formatLongDate, formatTime } from "@/presentation/lib/format";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelField, panelSave } from "./form-status";

const WHOLE_SHOP = "Toda la barbería";

function BlockRow({ block, remove }: { block: BlockItem; remove: (id: string) => Promise<AdminState> }) {
  const [state, setState] = useState<AdminState>({});
  const [pending, startTransition] = useTransition();
  const who = block.barberName ?? WHOLE_SHOP;
  const onRemove = () => {
    if (window.confirm(`¿Quitar el bloqueo de ${who}? Esas horas volverán a poder reservarse.`)) {
      startTransition(async () => setState(await remove(block.id)));
    }
  };
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <p className="font-medium">{who}</p>
      <p className="text-sm first-letter:uppercase">
        {formatLongDate(block.start)}, {formatTime(block.start)}
      </p>
      <p className="text-sm">
        hasta {formatLongDate(block.end)}, {formatTime(block.end)}
      </p>
      {block.reason && <p className="text-sm text-muted-foreground wrap-anywhere">{block.reason}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={onRemove}
        aria-label={`Quitar bloqueo de ${who}`}
        className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input px-4 text-sm transition-colors duration-200 hover:border-primary disabled:cursor-wait disabled:opacity-50"
      >
        Quitar
      </button>
      <FormStatus state={state} />
    </li>
  );
}

/** Vacaciones, feriados o ausencias: esas horas dejan de ofrecerse en la reserva. */
export function BlocksEditor(props: {
  blocks: BlockItem[];
  barbers: Barber[];
  today: string;
  add: AdminAction;
  remove: (id: string) => Promise<AdminState>;
}) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(props.add, {});
  const [partial, setPartial] = useState(false);
  return (
    <div className="mt-4 space-y-4">
      <form action={formAction} aria-label="Añadir bloqueo" className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <label htmlFor="block-barber" className="mb-1 block text-sm">
            Quién
          </label>
          <select id="block-barber" name="barberId" className={panelField}>
            <option value="">{WHOLE_SHOP}</option>
            {props.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="block-from" className="mb-1 block text-sm">
              Desde
            </label>
            <input id="block-from" name="from" type="date" required min={props.today} className={panelField} />
          </div>
          <div>
            <label htmlFor="block-to" className="mb-1 block text-sm">
              Hasta
            </label>
            <input id="block-to" name="to" type="date" required min={props.today} className={panelField} />
          </div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-5 accent-primary" />
          Solo unas horas
        </label>
        {partial && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="block-from-time" className="mb-1 block text-sm">
                Hora de inicio
              </label>
              <input id="block-from-time" name="fromTime" type="time" required className={panelField} />
            </div>
            <div>
              <label htmlFor="block-to-time" className="mb-1 block text-sm">
                Hora de fin
              </label>
              <input id="block-to-time" name="toTime" type="time" required className={panelField} />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="block-reason" className="mb-1 block text-sm">
            Motivo (opcional, no lo ven los clientes)
          </label>
          <input id="block-reason" name="reason" maxLength={120} className={panelField} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={panelSave}>
            {pending ? "Guardando…" : "Añadir bloqueo"}
          </button>
          <FormStatus state={state} />
        </div>
      </form>

      {props.blocks.length === 0 ? (
        <p className="text-muted-foreground">No hay bloqueos vigentes.</p>
      ) : (
        <ul aria-label="Bloqueos vigentes" className="space-y-3">
          {props.blocks.map((block) => (
            <BlockRow key={block.id} block={block} remove={props.remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
