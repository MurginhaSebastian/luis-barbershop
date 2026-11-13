import { CONFIRM_BEFORE_START_MINUTES, CONFIRM_WITHIN_MINUTES } from "../scheduling/booking-policy";
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

/** Hasta cuándo puede confirmar: 2 h tras reservar, o 1 h antes de la cita si eso llega antes. */
export function confirmationDeadline(bookedAt: Date, start: Date): Date {
  return new Date(
    Math.min(
      bookedAt.getTime() + CONFIRM_WITHIN_MINUTES * MINUTE_MS,
      start.getTime() - CONFIRM_BEFORE_START_MINUTES * MINUTE_MS,
    ),
  );
}

/** Código a partir de 6 bytes aleatorios (los genera quien llama: el dominio no depende de crypto). */
export function confirmationCode(randomBytes: Uint8Array): string {
  if (randomBytes.length < CONFIRMATION_CODE_BYTES) throw new Error("Faltan bytes para el código.");
  const pick = (alphabet: string, byte: number) => alphabet[byte % alphabet.length];
  const [a, b, c, d, e, f] = randomBytes;
  return pick(LETTERS, a) + pick(LETTERS, b) + pick(LETTERS, c) + pick(DIGITS, d) + pick(DIGITS, e) + pick(DIGITS, f);
}

/** El código que trae un mensaje como "Confirmo mi cita KRT482" (o "krt-482"), o null si no trae ninguno. */
export function codeInMessage(text: string): string | null {
  const match = CODE_IN_TEXT.exec(text.toUpperCase());
  return match ? match[1] + match[2] : null;
}
