"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Lleva la vista a los resultados al aparecer (en móvil quedan debajo del formulario). */
export function ScrollIntoView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
