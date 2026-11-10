"use client";

import { Bell, BellOff } from "lucide-react";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import type { AdminState } from "./admin-state";
import { FormStatus, panelSave } from "./form-status";

type Status = "checking" | "unsupported" | "ios" | "denied" | "off" | "on";

interface PushToggleProps {
  /** Clave pública VAPID; null si el servidor no tiene claves y no puede enviar avisos. */
  publicKey: string | null;
  subscribe: (subscription: unknown) => Promise<AdminState>;
  unsubscribe: (endpoint: unknown) => Promise<AdminState>;
  sendTest: () => Promise<AdminState>;
}

const SCOPE = "/panel";

function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: SCOPE, updateViaCache: "none" });
}

/** En iPhone los avisos solo existen con el panel instalado en la pantalla de inicio. */
function isIosBrowser() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
}

async function detectStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIosBrowser() ? "ios" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Activar, probar y desactivar los avisos de reservas en el dispositivo que se está usando. */
export function PushToggle({ publicKey, subscribe, unsubscribe, sendTest }: PushToggleProps) {
  const [status, setStatus] = useState<Status>("checking");
  const [state, setState] = useState<AdminState>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (publicKey) detectStatus().then(setStatus);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <Box>
        Los avisos no están configurados en el servidor: faltan las claves (<code>npm run panel:push</code>).
      </Box>
    );
  }
  if (status === "checking") return <Box>Comprobando los avisos de este dispositivo…</Box>;
  if (status === "unsupported") return <Box>Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari.</Box>;
  if (status === "ios") {
    return (
      <Box>
        En iPhone: toca Compartir y luego «Añadir a pantalla de inicio». Abre el panel desde ese icono y activa aquí
        los avisos.
      </Box>
    );
  }
  if (status === "denied") {
    return <Box>Bloqueaste los avisos de esta web. Permítelos en los ajustes del navegador y recarga la página.</Box>;
  }

  const activate = () =>
    startTransition(async () => {
      setState({});
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        await registration();
        const reg = await navigator.serviceWorker.ready;
        // Una suscripción antigua (por ejemplo, de otras claves) impediría crear la nueva.
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
        const result = await subscribe(sub.toJSON());
        if (result.error) await sub.unsubscribe();
        else setStatus("on");
        setState(result);
      } catch {
        setState({ error: "El navegador no pudo activar los avisos. Inténtalo de nuevo." });
      }
    });

  const deactivate = () =>
    startTransition(async () => {
      setState({});
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setState(await unsubscribe(sub.endpoint));
      }
      setStatus("off");
    });

  const test = () =>
    startTransition(async () => {
      setState({});
      setState(await sendTest());
    });

  return (
    <Box>
      <div className="flex flex-wrap items-center gap-3">
        {status === "on" ? (
          <>
            <span className="inline-flex items-center gap-2 text-foreground">
              <Bell aria-hidden className="size-4 text-primary" /> Avisos activados en este dispositivo
            </span>
            <button type="button" onClick={test} disabled={pending} className={panelSave}>
              Enviar prueba
            </button>
            <button type="button" onClick={deactivate} disabled={pending} className={secondary}>
              Desactivar
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-2">
              <BellOff aria-hidden className="size-4" /> Recibe un aviso en este dispositivo con cada reserva nueva.
            </span>
            <button type="button" onClick={activate} disabled={pending} className={panelSave}>
              Activar avisos
            </button>
          </>
        )}
      </div>
      <FormStatus state={state} />
    </Box>
  );
}

const secondary =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border px-5 text-sm transition-colors duration-200 hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Box({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Avisos en este dispositivo" className="mt-4 grid gap-2 rounded-2xl border border-border p-4 text-sm text-muted-foreground">
      {children}
    </section>
  );
}
