import { InvalidSettingsError } from "../errors/domain-errors";

/** Un dispositivo del panel que quiere avisos: lo entrega el navegador al activar las notificaciones. */
export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MAX_ENDPOINT = 1000;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** El servidor enviará peticiones a ese endpoint: solo https y claves con el formato del estándar. */
export function assertValidSubscription({ endpoint, p256dh, auth }: PushSubscription) {
  let url: URL | null = null;
  try {
    url = new URL(endpoint);
  } catch {}
  if (!url || url.protocol !== "https:" || endpoint.length > MAX_ENDPOINT) {
    throw new InvalidSettingsError("Este navegador entregó una suscripción no válida.");
  }
  // p256dh: clave pública P-256 sin comprimir (65 bytes → 87 caracteres); auth: 16 bytes (22 caracteres).
  if (!BASE64URL.test(p256dh) || p256dh.length < 86 || p256dh.length > 90 || !BASE64URL.test(auth) || auth.length < 21 || auth.length > 24) {
    throw new InvalidSettingsError("Este navegador entregó una suscripción no válida.");
  }
}
