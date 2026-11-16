import { AT_RISK_MINUTES_BEFORE } from "../scheduling/booking-policy";
import { MINUTE_MS } from "./time-slot";

/** El cliente confirma su cita escribiendo este código por WhatsApp antes de `confirmBy`. */
export interface BookingConfirmation {
  appointmentId: string;
  code: string;
  confirmBy: Date;
}

// Tres letras y tres cifras ("KRT482"): ninguna palabra la imita y no lleva 0/O ni 1/I/L, que se confunden.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";
export const CONFIRMATION_CODE_BYTES = 6;
const CODE_IN_TEXT = new RegExp(`(?<![A-Z0-9])([${LETTERS}]{3})[\\s-]?([${DIGITS}]{3})(?![A-Z0-9])`);

/** Hasta cuándo su hora es solo suya: 15 min antes de la cita. Después queda en riesgo (otro puede tomarla). */
export function confirmationDeadline(start: Date): Date {
  return new Date(start.getTime() - AT_RISK_MINUTES_BEFORE * MINUTE_MS);
}

/** Código a partir de 6 bytes aleatorios (los genera quien llama: el dominio no depende de crypto). */
export function confirmationCode(randomBytes: Uint8Array): string {
  if (randomBytes.length < CONFIRMATION_CODE_BYTES) throw new Error("Faltan bytes para el código.");
  const pick = (alphabet: string, byte: number) => alphabet[byte % alphabet.length];
  const [a, b, c, d, e, f] = randomBytes;
  return pick(LETTERS, a) + pick(LETTERS, b) + pick(LETTERS, c) + pick(DIGITS, d) + pick(DIGITS, e) + pick(DIGITS, f);
}

// "Cancelar KRT482" (el botón del aviso), "no podré ir", "no voy", "anula mi cita"…
const CANCEL_IN_TEXT = /cancel|anul|\bno\s+(podr|voy|ir\b|asist)/i;

/** ¿El mensaje pide cancelar en vez de confirmar? */
export function wantsToCancel(text: string): boolean {
  return CANCEL_IN_TEXT.test(text);
}

/** El código que trae un mensaje como "Confirmo mi cita KRT482" (o "krt-482"), o null si no trae ninguno. */
export function codeInMessage(text: string): string | null {
  const match = CODE_IN_TEXT.exec(text.toUpperCase());
  return match ? match[1] + match[2] : null;
}
