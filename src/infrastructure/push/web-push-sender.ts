import webpush from "web-push";
import type { IPushSender, PushMessage } from "@/application/ports/push";
import type { PushSubscription } from "@/core/entities/push";

export interface VapidKeys {
  /** mailto: o https: de contacto, exigido por los servicios de push. */
  subject: string;
  publicKey: string;
  privateKey: string;
}

const ONE_DAY_SECONDS = 24 * 60 * 60;

/** Cifra el aviso con web-push (estándar RFC 8291) y lo entrega por fetch al servicio de push del navegador. */
export class WebPushSender implements IPushSender {
  constructor(
    private readonly vapid: VapidKeys,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(subscription: PushSubscription, message: PushMessage): Promise<"sent" | "gone"> {
    const request = webpush.generateRequestDetails(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(message),
      { vapidDetails: this.vapid, TTL: ONE_DAY_SECONDS, urgency: "high" },
    );
    // fetch calcula la longitud por su cuenta.
    const headers = Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => name.toLowerCase() !== "content-length").map(([k, v]) => [k, String(v)]),
    );
    const response = await this.fetchImpl(request.endpoint, {
      method: request.method,
      headers,
      body: request.body ? new Uint8Array(request.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "sent";
    // 404 y 410: el navegador anuló la suscripción (avisos desactivados, app desinstalada).
    if (response.status === 404 || response.status === 410) return "gone";
    throw new Error(`El servicio de push respondió ${response.status}.`);
  }
}

/** Sin las tres variables no hay avisos: el panel lo explica en vez de fallar. */
export function readVapidKeys(env: Record<string, string | undefined>): VapidKeys | null {
  const { VAPID_SUBJECT: subject, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = env;
  return subject && publicKey && privateKey ? { subject, publicKey, privateKey } : null;
}
