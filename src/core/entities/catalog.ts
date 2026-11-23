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
  /** Opcional para no tocar los barberos falsos de las pruebas; ausente = false. */
  isOwner?: boolean;
}

/** Orden estable con el dueño al final: es el último recurso al repartir citas. */
export function ownerLast<T extends { isOwner?: boolean }>(list: readonly T[]): T[] {
  return [...list.filter((b) => !b.isOwner), ...list.filter((b) => b.isOwner)];
}

export interface ScheduleBlock {
  id: string;
  /** null = toda la barbería (feriado, cierre). */
  barberId: string | null;
  slot: TimeSlot;
  reason: string | null;
}
