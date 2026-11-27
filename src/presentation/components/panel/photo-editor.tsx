"use client";

import Image from "next/image";
import { startTransition, useActionState, useState } from "react";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelGold } from "./form-status";

const MAX_BYTES = 5 * 1024 * 1024;

export interface PhotoSlot {
  /** "hero" o "service:<id>": qué foto cambia. */
  target: string;
  label: string;
  /** Dónde se ve esa foto, si no es evidente. */
  hint?: string;
  current?: string | null;
  fallback: string;
}

/** Una foto de la web: la actual (o la de ejemplo), subir otra y volver a la de ejemplo. */
function PhotoForm({ slot, upload, remove }: { slot: PhotoSlot; upload: AdminAction; remove: AdminAction }) {
  const [state, uploadAction, uploading] = useActionState<AdminState, FormData>(upload, {});
  const [removeState, removeAction, removing] = useActionState<AdminState, FormData>(remove, {});
  const [tooBig, setTooBig] = useState(false);
  const id = `foto-${slot.target.replace(":", "-")}`;

  return (
    <li className="flex flex-col gap-3 rounded-md border border-light-outline bg-light-card p-4 text-on-light-card">
      <h3 className="text-base font-semibold wrap-anywhere">{slot.label}</h3>
      {slot.hint && <p className="text-sm text-light-muted">{slot.hint}</p>}
      <div className="relative aspect-video overflow-hidden rounded-sm ring-1 ring-light-outline">
        <Image
          src={slot.current ?? slot.fallback}
          alt={`Foto actual: ${slot.label}`}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 40vw, 90vw"
          className="object-cover"
        />
        {!slot.current && (
          <span className="absolute top-2 left-2 rounded-full bg-dark-canvas px-3 py-1 text-xs font-semibold text-gold">Foto de ejemplo</span>
        )}
      </div>
      <form
        // Sin `action=`, como el resto del panel; el archivo ya va dentro del FormData cuando se limpia el campo.
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          form.reset();
          setTooBig(false);
          startTransition(() => uploadAction(data));
        }}
        aria-label={`Subir foto: ${slot.label}`}
        className="space-y-2"
      >
        <input type="hidden" name="target" value={slot.target} />
        <label htmlFor={id} className="block text-sm">
          Nueva foto (JPG, PNG o WebP, hasta 5 MB)
        </label>
        <input
          id={id}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_BYTES)}
          className="block w-full text-sm file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-sm file:border file:border-light-outline file:bg-light-canvas file:px-4 file:text-on-light-card"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={uploading || tooBig} className={panelGold}>
            {uploading ? "Subiendo…" : "Subir foto"}
          </button>
          <FormStatus state={tooBig ? { error: "La foto pesa más de 5 MB." } : state} />
        </div>
      </form>
      {slot.current && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => removeAction(data));
          }}
        >
          <input type="hidden" name="target" value={slot.target} />
          <button
            type="submit"
            disabled={removing}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-sm border border-light-outline bg-light-canvas px-4 text-sm font-semibold transition-colors duration-150 hover:border-gold-on-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
          >
            Volver a la foto de ejemplo
          </button>
        </form>
      )}
      {/* Fuera del formulario: al quitar la foto el botón desaparece, pero la confirmación debe verse. */}
      <FormStatus state={removeState} />
    </li>
  );
}

export function PhotoEditor({ slots, upload, remove }: { slots: PhotoSlot[]; upload: AdminAction; remove: AdminAction }) {
  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {slots.map((slot) => (
        <PhotoForm key={slot.target} slot={slot} upload={upload} remove={remove} />
      ))}
    </ul>
  );
}
