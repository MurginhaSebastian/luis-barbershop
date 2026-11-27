"use client";

import { startTransition, useActionState, useState } from "react";
import type { ShopContact, SiteSection, SiteSettings } from "@/core/entities/site";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, lightField, panelGold } from "./form-status";
import { Switch } from "./hours-editor";

const CONTACT_FIELDS: { name: keyof ShopContact; label: string; placeholder: string; inputMode?: "tel" | "url" }[] = [
  { name: "whatsapp", label: "WhatsApp", placeholder: "9xx xxx xxx", inputMode: "tel" },
  { name: "address", label: "Dirección", placeholder: "Av. … 123, distrito" },
  { name: "mapsUrl", label: "Enlace de Google Maps", placeholder: "https://maps.app.goo.gl/…", inputMode: "url" },
  { name: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/…", inputMode: "url" },
  { name: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/…", inputMode: "url" },
  { name: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@…", inputMode: "url" },
  { name: "complaintsUrl", label: "Libro de Reclamaciones", placeholder: "https://…", inputMode: "url" },
];

const SECTION_LABELS: Record<SiteSection, string> = {
  about: "Nosotros",
  paraEllas: "Para ellas (Spa y estilista)",
  whyUs: "Por qué venir",
  howToBook: "Cómo reservar",
  products: "Productos para llevar",
  visit: "Horario y ubicación",
};

/** El WhatsApp se guarda como 51 + 9 dígitos; aquí se muestra como lo escribe la gente. */
const localPhone = (whatsapp?: string) => whatsapp?.replace(/^51/, "") ?? "";

export function ContactForm({ contact, action }: { contact: ShopContact; action: AdminAction }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CONTACT_FIELDS.map(({ name }) => [name, name === "whatsapp" ? localPhone(contact.whatsapp) : (contact[name] ?? "")]),
    ),
  );
  const [state, formAction, pending] = useActionState<AdminState, FormData>(action, {});
  return (
    <form
      // Sin `action=`, como el resto del panel: su form.reset() no debe tocar los campos controlados.
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => formAction(form));
      }}
      aria-label="Contacto"
      className="space-y-4"
    >
      <p className="text-sm text-light-muted">Deja vacío lo que no quieras mostrar.</p>
      <div className="grid gap-4 md:grid-cols-2">
      {CONTACT_FIELDS.map((field) => (
        <div key={field.name}>
          <label htmlFor={`contact-${field.name}`} className="mb-1 block text-sm font-medium">
            {field.label}
          </label>
          <input
            id={`contact-${field.name}`}
            name={field.name}
            inputMode={field.inputMode}
            placeholder={field.placeholder}
            value={values[field.name]}
            onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
            className={lightField}
          />
        </div>
      ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={panelGold}>
          {pending ? "Guardando…" : "Guardar contacto"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function SectionsForm({ sections, action }: { sections: SiteSettings["sections"]; action: AdminAction }) {
  const [visible, setVisible] = useState(sections);
  const [state, formAction, pending] = useActionState<AdminState, FormData>(action, {});
  return (
    <form
      // Sin `action=`: su form.reset() devolvería las casillas controladas a su valor inicial.
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => formAction(form));
      }}
      aria-label="Secciones visibles"
      className="space-y-4"
    >
      <p className="text-sm text-light-muted">Servicios y reserva se muestran siempre.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(SECTION_LABELS) as SiteSection[]).map((section) => (
          <div key={section} className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-light-outline bg-light-canvas px-3">
            <span className="text-sm font-medium">{SECTION_LABELS[section]}</span>
            <Switch
              name={section}
              label={SECTION_LABELS[section]}
              checked={visible[section]}
              onChange={(on) => setVisible({ ...visible, [section]: on })}
              on="Visible"
              off="Oculta"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={panelGold}>
          {pending ? "Guardando…" : "Guardar secciones"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
