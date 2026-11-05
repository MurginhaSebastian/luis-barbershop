import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_HOURS = 12;
const SESSION_MS = SESSION_HOURS * 3_600_000;

const sign = (expires: string, secret: string) => createHmac("sha256", secret).update(expires).digest("hex");

/** Sesión sin estado: la fecha de caducidad firmada con el secreto del servidor. */
export function createSessionToken(secret: string, now: Date): string {
  const expires = String(now.getTime() + SESSION_MS);
  return `${expires}.${sign(expires, secret)}`;
}

export function isValidSessionToken(token: string | undefined, secret: string, now: Date): boolean {
  const [expires, signature] = token?.split(".") ?? [];
  if (!expires || !signature) return false;
  const expected = Buffer.from(sign(expires, secret));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
  return Number(expires) > now.getTime();
}

const MIN_SECRET_LENGTH = 32;

/** Sin clave ni secreto bien configurados, el panel no deja entrar a nadie. */
export function getPanelConfig(): { passwordHash: string; sessionSecret: string } | null {
  const { PANEL_PASSWORD_HASH: passwordHash, PANEL_SESSION_SECRET: sessionSecret } = process.env;
  if (!passwordHash || !sessionSecret || sessionSecret.length < MIN_SECRET_LENGTH) return null;
  return { passwordHash, sessionSecret };
}
