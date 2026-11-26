"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Motion carga solo las funciones de DOM (`m.*`) y respeta "reducir movimiento" del sistema. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
