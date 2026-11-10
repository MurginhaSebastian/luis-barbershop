"use server";

import { z } from "zod";
import { getUseCases } from "@/infrastructure/container";
import type { AdminState } from "@/presentation/components/panel/admin-state";
import { runAdmin } from "./run-admin";
import { requirePanelSession } from "./session";

// La forma de PushSubscription.toJSON(); el formato exacto de cada campo lo valida el dominio.
const subscriptionSchema = z.object({
  endpoint: z.string().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }),
});

export async function subscribePushAction(input: unknown): Promise<AdminState> {
  await requirePanelSession();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "El navegador no dio una suscripción válida." };
  const { endpoint, keys } = parsed.data;
  return runAdmin(async () => {
    await getUseCases().managePush.subscribe({ endpoint, ...keys });
    return { ok: "Avisos activados en este dispositivo." };
  });
}

export async function unsubscribePushAction(endpoint: unknown): Promise<AdminState> {
  await requirePanelSession();
  const parsed = z.string().max(1000).safeParse(endpoint);
  if (!parsed.success) return { error: "No se pudo identificar el dispositivo." };
  return runAdmin(async () => {
    await getUseCases().managePush.unsubscribe(parsed.data);
    return { ok: "Avisos desactivados en este dispositivo." };
  });
}

export async function sendTestPushAction(): Promise<AdminState> {
  await requirePanelSession();
  return runAdmin(async () => {
    const { sent } = await getUseCases().managePush.sendTest();
    if (sent === 0) return { error: "No llegó a ningún dispositivo. Desactiva y vuelve a activar los avisos." };
    return { ok: `Aviso enviado a ${sent} ${sent === 1 ? "dispositivo" : "dispositivos"}.` };
  });
}
