import type { TimeSlot } from "./time-slot";

/** Precios en céntimos de sol (PEN) para no operar con decimales. */
export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  /** Foto propia subida desde el panel; sin ella la web usa una de ejemplo. */
  imageUrl?: string | null;
}

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
}

export interface Barber {
  id: string;
  name: string;
  active: boolean;
}

export interface ScheduleBlock {
  id: string;
  /** null = toda la barbería (feriado, cierre). */
  barberId: string | null;
  slot: TimeSlot;
  reason: string | null;
}
