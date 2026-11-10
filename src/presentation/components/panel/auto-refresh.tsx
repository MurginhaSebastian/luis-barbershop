"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EVERY_MS = 60_000;

/** Trae las reservas nuevas sin recargar: al llegar un aviso push, cada minuto y al volver a la pestaña. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    // El service worker (public/sw.js) avisa a las pestañas abiertas en cuanto llega una reserva.
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === "push") router.refresh();
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [router]);
  return null;
}
