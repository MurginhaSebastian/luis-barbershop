"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

/** Entrada suave al hacer scroll (solo opacity y transform). Nunca en el hero: no retrasa el LCP. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </m.div>
  );
}
