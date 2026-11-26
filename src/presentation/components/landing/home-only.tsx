"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Contenido que solo lleva la portada (la cabecera y el pie son comunes a toda la web). */
export function HomeOnly({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? children : null;
}
