"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { primaryButtonClass } from "./styles";

/** Botón de envío que se desactiva y avisa mientras el formulario está en curso. */
export function SubmitButton(props: { children: ReactNode; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={`${primaryButtonClass} w-full sm:w-auto`}>
      {pending ? props.pendingLabel : props.children}
    </button>
  );
}
