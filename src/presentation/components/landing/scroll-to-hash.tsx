"use client";

import { useEffect } from "react";

/** Las secciones llegan en streaming, después del salto del navegador al #ancla: se repite aquí. */
export function ScrollToHash() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
