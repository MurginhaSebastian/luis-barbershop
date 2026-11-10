"use client";

import { useActionState, useState } from "react";
import type { ShopContact, SiteSection, SiteSettings } from "@/core/entities/site";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelField, panelSave } from "./form-status";

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
    <form action={formAction} aria-label="Contacto" className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Deja vacío lo que no quieras mostrar.</p>
      {CONTACT_FIELDS.map((field) => (
        <div key={field.name}>
          <label htmlFor={`contact-${field.name}`} className="mb-1 block text-sm">
            {field.label}
          </label>
          <input
            id={`contact-${field.name}`}
            name={field.name}
            inputMode={field.inputMode}
            placeholder={field.placeholder}
            value={values[field.name]}
            onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
            className={panelField}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={panelSave}>
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
    <form action={formAction} aria-label="Secciones visibles" className="mt-4 space-y-1 rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-sm text-muted-foreground">Servicios y reserva se muestran siempre.</p>
      {(Object.keys(SECTION_LABELS) as SiteSection[]).map((section) => (
        <label key={section} className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name={section}
            checked={visible[section]}
            onChange={(e) => setVisible({ ...visible, [section]: e.target.checked })}
            className="size-5 accent-primary"
          />
          {SECTION_LABELS[section]}
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className={panelSave}>
          {pending ? "Guardando…" : "Guardar secciones"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
