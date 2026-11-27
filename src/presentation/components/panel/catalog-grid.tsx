"use client";

import { Pencil, Plus } from "lucide-react";
import { startTransition, useState } from "react";
import { cn } from "@/presentation/lib/utils";
import type { AdminAction, AdminState } from "./admin-state";
import { type EditableField, type EditableItem, ItemForm } from "./editable-list";
import { FormStatus } from "./form-status";

export interface CatalogItem extends EditableItem {
  /** Texto bajo el nombre, p. ej. "30 min". */
  meta?: string;
  /** Precio ya formateado, arriba a la derecha. */
  price?: string;
  badge?: { label: string; tone: "dark" | "spa" };
  /** Valor que compara el filtro. */
  group?: string;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light";

function Card({ item, fields, action }: { item: CatalogItem; fields: EditableField[]; action: AdminAction }) {
  const [active, setActive] = useState(item.active);
  const [seen, setSeen] = useState(item.active);
  const [state, setState] = useState<AdminState>({});
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  // Si el servidor trae otro valor (p. ej. tras editar), el interruptor lo sigue.
  if (seen !== item.active) {
    setSeen(item.active);
    setActive(item.active);
  }

  // La acción exige el formulario completo: se envía con los valores actuales y `active` invertido.
  function toggle(next: boolean) {
    const form = new FormData();
    form.set("id", item.id);
    for (const field of fields) form.set(field.name, item.values[field.name]);
    if (next) form.set("active", "on");
    setActive(next);
    setPending(true);
    setState({});
    startTransition(async () => {
      const result = await action({}, form);
      if (result.error) setActive(!next);
      setState(result);
      setPending(false);
    });
  }

  return (
    <article className="flex flex-col justify-between gap-4 rounded-md border border-light-outline bg-light-card p-4 text-on-light-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {item.badge && (
            <span
              className={cn(
                "self-start rounded-sm px-2.5 py-0.5 text-xs font-semibold tracking-wider uppercase",
                item.badge.tone === "spa" ? "border border-spa-outline bg-spa-surface text-spa-primary" : "bg-dark-canvas text-gold",
              )}
            >
              {item.badge.label}
            </span>
          )}
          <h2 className="text-lg font-semibold wrap-anywhere">{item.title}</h2>
          {item.meta && <p className="text-sm text-light-muted tabular-nums">{item.meta}</p>}
        </div>
        {item.price && <span className="shrink-0 text-lg font-semibold tabular-nums">{item.price}</span>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-light-outline pt-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            role="switch"
            checked={active}
            disabled={pending}
            aria-label={`${active ? "Visible" : "Oculto"}: ${item.title}`}
            onChange={(e) => toggle(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-on-light peer-disabled:opacity-50 motion-reduce:transition-none",
              active ? "bg-dark-canvas" : "bg-light-outline",
            )}
          >
            <span
              className={cn(
                "inline-block size-5 rounded-full transition-transform duration-150 motion-reduce:transition-none",
                active ? "translate-x-5 bg-gold" : "translate-x-0 bg-light-card",
              )}
            />
          </span>
          <span className={active ? "" : "text-light-muted"}>{active ? "Visible" : "Oculto"}</span>
        </label>
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-light-outline bg-light-canvas px-3 text-sm font-semibold transition-colors duration-150 hover:border-gold-on-light motion-reduce:transition-none",
            FOCUS,
          )}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Editar
        </button>
      </div>
      <FormStatus state={state} />
      {editing && <ItemForm item={item} heading={item.title} fields={fields} action={action} />}
    </article>
  );
}

/** Rejilla de tarjetas con filtro, interruptor Visible/Oculto y alta; sirve para servicios, productos y profesionales. */
export function CatalogGrid(props: {
  title: string;
  note?: string;
  items: CatalogItem[];
  fields: EditableField[];
  action: AdminAction;
  addLabel: string;
  addHeading: string;
  filters?: { value: string; label: string }[];
}) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const shown = props.items.filter((i) => !filter || i.group === filter);
  const tabs = props.filters ? [{ value: "", label: "Todos" }, ...props.filters] : [];
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-light-outline bg-light-card px-4 py-2.5 text-on-light-card sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-heading text-3xl">{props.title}</h1>
          {tabs.length > 0 && (
            <div className="inline-flex flex-wrap items-center rounded-sm border border-light-outline bg-light-canvas p-0.5">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={filter === t.value}
                  onClick={() => setFilter(t.value)}
                  className={cn(
                    "min-h-8 rounded-sm px-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none",
                    FOCUS,
                    filter === t.value ? "bg-dark-canvas text-on-dark-canvas" : "text-light-muted hover:text-on-light-card",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1 rounded-sm bg-gold px-4 text-sm font-semibold text-on-gold transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none",
            FOCUS,
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          {props.addLabel}
        </button>
      </header>
      {props.note && <p className="mt-3 text-sm text-light-muted">{props.note}</p>}
      {adding && (
        <div className="mt-4">
          <ItemForm heading={props.addHeading} fields={props.fields} action={props.action} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        {shown.map((item) => (
          <Card key={item.id} item={item} fields={props.fields} action={props.action} />
        ))}
      </div>
    </>
  );
}
