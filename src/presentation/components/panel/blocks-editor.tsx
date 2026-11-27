"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import type { BlockItem } from "@/application/use-cases/admin/manage-schedule";
import type { Barber } from "@/core/entities/catalog";
import { shopDateOf } from "@/core/scheduling/availability";
import { formatDayParts, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import type { AdminAction, AdminState } from "./admin-state";
import { FormDialog } from "./catalog-grid";
import { FormStatus } from "./form-status";

const WHOLE_SHOP = "Toda la barbería";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light";
const FIELD = cn(
  "h-10 w-full rounded-sm border border-light-outline bg-light-canvas px-3 text-sm text-on-light-card",
  FOCUS,
);
const SECONDARY = cn(
  "inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-light-outline bg-light-canvas px-3 text-sm font-semibold transition-colors duration-150 hover:border-gold-on-light disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none",
  FOCUS,
);

/** "9 dic" desde un instante, en la zona de la barbería. */
function shortDate(iso: string | Date) {
  const { day, month } = formatDayParts(shopDateOf(new Date(iso)));
  return `${day} ${month}`;
}

function BlockCard({ block, remove }: { block: BlockItem; remove: (id: string) => Promise<AdminState> }) {
  const [state, setState] = useState<AdminState>({});
  const [pending, startRemoving] = useTransition();
  const who = block.barberName ?? WHOLE_SHOP;
  const first = shopDateOf(new Date(block.start));
  // El fin es exclusivo: un bloqueo de día entero termina a las 00:00 del día siguiente.
  const lastDay = shortDate(new Date(new Date(block.end).getTime() - 1));
  const dates = shortDate(block.start) === lastDay ? shortDate(block.start) : `${shortDate(block.start)} – ${lastDay}`;
  const onRemove = () => {
    if (window.confirm(`¿Quitar el bloqueo de ${who}? Esas horas volverán a poder reservarse.`)) {
      startRemoving(async () => setState(await remove(block.id)));
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-md border border-light-outline bg-light-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold wrap-anywhere">{block.reason ? `${dates} · ${block.reason}` : dates}</p>
          <p className="text-sm text-light-muted wrap-anywhere">
            {who} · {formatTime(block.start)} – {formatTime(block.end)}
          </p>
        </div>
        <button type="button" disabled={pending} onClick={onRemove} aria-label={`Quitar bloqueo de ${who}`} className={SECONDARY}>
          <Trash2 className="size-4" aria-hidden="true" />
          Quitar
        </button>
      </div>
      <Link
        href={`/panel?vista=dia&dia=${first}`}
        className={cn("self-start text-sm font-semibold underline underline-offset-2 hover:text-gold-on-light", FOCUS)}
      >
        Revisar en agenda
      </Link>
      <FormStatus state={state} />
    </li>
  );
}

function BlockForm(props: { barbers: Barber[]; today: string; add: AdminAction; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(props.add, {});
  const [partial, setPartial] = useState(false);
  return (
    <form
      // `action=` haría form.reset() al terminar y devolvería "Solo unas horas" a su valor inicial.
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => formAction(form));
      }}
      aria-label="Añadir bloqueo"
      className="space-y-3 rounded-md border border-light-outline bg-light-card p-5 text-on-light-card"
    >
      <h3 className="font-heading text-2xl">Nuevo bloqueo</h3>
      <div>
        <label htmlFor="block-barber" className="mb-1 block text-sm">
          Quién
        </label>
        <select id="block-barber" name="barberId" className={FIELD}>
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
          <input id="block-from" name="from" type="date" required min={props.today} className={FIELD} />
        </div>
        <div>
          <label htmlFor="block-to" className="mb-1 block text-sm">
            Hasta
          </label>
          <input id="block-to" name="to" type="date" required min={props.today} className={FIELD} />
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="size-5 accent-gold-on-light" />
        Solo unas horas
      </label>
      {partial && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="block-from-time" className="mb-1 block text-sm">
              Hora de inicio
            </label>
            <input id="block-from-time" name="fromTime" type="time" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="block-to-time" className="mb-1 block text-sm">
              Hora de fin
            </label>
            <input id="block-to-time" name="toTime" type="time" required className={FIELD} />
          </div>
        </div>
      )}
      <div>
        <label htmlFor="block-reason" className="mb-1 block text-sm">
          Motivo (opcional, no lo ven los clientes)
        </label>
        <input id="block-reason" name="reason" maxLength={120} className={FIELD} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-semibold text-on-gold transition-opacity duration-150 hover:opacity-90 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none",
            FOCUS,
          )}
        >
          {pending ? "Guardando…" : "Añadir bloqueo"}
        </button>
        <button type="button" onClick={props.onClose} className={SECONDARY}>
          Cerrar
        </button>
      </div>
      <FormStatus state={state} />
    </form>
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
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="bloqueos" className="rounded-md border border-light-outline bg-light-card text-on-light-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-light-outline p-4 sm:px-6">
        <div>
          <h2 id="bloqueos" className="text-lg font-semibold">
            Bloqueos y feriados
          </h2>
          <p className="text-sm text-light-muted">Cierra días especiales para toda la barbería o un profesional.</p>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAdding(true)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1 rounded-sm border border-light-outline bg-light-canvas px-4 text-sm font-semibold transition-colors duration-150 hover:border-gold-on-light motion-reduce:transition-none",
            FOCUS,
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          Nuevo bloqueo
        </button>
      </div>
      <div className="p-4 sm:px-6">
        {props.blocks.length === 0 ? (
          <p className="text-light-muted">No hay bloqueos vigentes.</p>
        ) : (
          <ul aria-label="Bloqueos vigentes" className="space-y-3">
            {props.blocks.map((block) => (
              <BlockCard key={block.id} block={block} remove={props.remove} />
            ))}
          </ul>
        )}
      </div>
      <FormDialog open={adding} onClose={() => setAdding(false)}>
        <BlockForm barbers={props.barbers} today={props.today} add={props.add} onClose={() => setAdding(false)} />
      </FormDialog>
    </section>
  );
}
