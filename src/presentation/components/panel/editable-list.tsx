"use client";

import { useActionState, useState } from "react";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelField, panelSave } from "./form-status";

export interface EditableField {
  name: string;
  label: string;
  inputMode?: "numeric" | "decimal";
  hint?: string;
}

export interface EditableItem {
  id: string;
  title: string;
  active: boolean;
  values: Record<string, string>;
}

type ListProps = { fields: EditableField[]; action: AdminAction };

/** Ficha de un elemento. Campos controlados: un error al guardar no borra lo escrito. */
function ItemForm(props: ListProps & { item?: EditableItem; heading: string }) {
  const { item, fields } = props;
  const blank = Object.fromEntries(fields.map((f) => [f.name, ""]));
  const [values, setValues] = useState(item?.values ?? blank);
  const [active, setActive] = useState(item?.active ?? true);

  const [state, formAction, pending] = useActionState<AdminState, FormData>(async (prev, form) => {
    const result = await props.action(prev, form);
    if (!item && result.ok) {
      setValues(blank);
      setActive(true);
    }
    return result;
  }, {});

  const id = item?.id ?? "nuevo";
  return (
    <form action={formAction} aria-label={props.heading} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <h3 className="font-heading text-xl wrap-anywhere">{props.heading}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.name} className={field.name === "name" ? "sm:col-span-3" : undefined}>
            <label htmlFor={`${id}-${field.name}`} className="mb-1 block text-sm">
              {field.label}
            </label>
            <input
              id={`${id}-${field.name}`}
              name={field.name}
              required
              inputMode={field.inputMode}
              value={values[field.name]}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              className={panelField}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 accent-primary"
        />
        Visible en la web
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={panelSave}>
          {pending ? "Guardando…" : item ? "Guardar" : "Añadir"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

/** Lista editable del panel: una ficha por elemento y otra para añadir. */
export function EditableList(props: ListProps & { items: EditableItem[]; addHeading: string }) {
  return (
    <div className="mt-6 space-y-3">
      {props.items.map((item) => (
        <ItemForm key={item.id} item={item} heading={item.title} fields={props.fields} action={props.action} />
      ))}
      <ItemForm heading={props.addHeading} fields={props.fields} action={props.action} />
    </div>
  );
}
