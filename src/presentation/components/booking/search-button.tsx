"use client";

import { useFormStatus } from "react-dom";
import { outlineButtonClass } from "./styles";

/** Botón del formulario GET: avisa mientras se cargan los horarios. */
export function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={outlineButtonClass}>
      {pending ? "Buscando horarios…" : "Ver horarios"}
    </button>
  );
}
