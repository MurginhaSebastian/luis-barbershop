"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EVERY_MS = 60_000;

/** Trae las reservas nuevas sin recargar: cada minuto y al volver a la pestaña. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
