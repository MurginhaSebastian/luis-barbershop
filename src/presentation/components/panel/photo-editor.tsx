"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import type { AdminAction, AdminState } from "./admin-state";
import { FormStatus, panelSave } from "./form-status";

const MAX_BYTES = 5 * 1024 * 1024;

export interface PhotoSlot {
  /** "hero" o "service:<id>": qué foto cambia. */
  target: string;
  label: string;
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
    <li className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="font-heading text-xl wrap-anywhere">{slot.label}</h3>
      <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-border">
        <Image src={slot.current ?? slot.fallback} alt={`Foto actual: ${slot.label}`} fill sizes="(min-width: 768px) 40vw, 90vw" className="object-cover" />
        {!slot.current && (
          <span className="absolute top-2 left-2 rounded-full bg-background/90 px-3 py-1 text-xs">Foto de ejemplo</span>
        )}
      </div>
      <form action={uploadAction} aria-label={`Subir foto: ${slot.label}`} className="space-y-2">
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
          className="block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-input file:bg-background file:px-4 file:text-foreground"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={uploading || tooBig} className={panelSave}>
            {uploading ? "Subiendo…" : "Subir foto"}
          </button>
          <FormStatus state={tooBig ? { error: "La foto pesa más de 5 MB." } : state} />
        </div>
      </form>
      {slot.current && (
        <form action={removeAction}>
          <input type="hidden" name="target" value={slot.target} />
          <button
            type="submit"
            disabled={removing}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input px-4 text-sm transition-colors duration-200 hover:border-primary disabled:cursor-wait disabled:opacity-50"
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
    <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {slots.map((slot) => (
        <PhotoForm key={slot.target} slot={slot} upload={upload} remove={remove} />
      ))}
    </ul>
  );
}
