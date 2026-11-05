// El flujo de reserva vive en la URL: el botón Atrás funciona y recargar no pierde nada.

export const ANY_BARBER = "cualquiera";

export type BookingStep = 1 | 2 | 3 | 4;

export const BOOKING_STEPS = [
  { step: 1, label: "Servicios" },
  { step: 2, label: "Barbero" },
  { step: 3, label: "Hora" },
  { step: 4, label: "Tus datos" },
] as const;

export interface BookingSelection {
  servicios: string[];
  barbero?: string;
  dia?: string;
  hora?: string;
}

/** El paso pedido, sin dejar saltarse uno al que le falten datos. Sin paso pedido, el primero. */
export function resolveStep(requested: number | undefined, { servicios, barbero, dia, hora }: BookingSelection): BookingStep {
  const reachable: BookingStep = servicios.length === 0 ? 1 : !barbero ? 2 : !dia || !hora ? 3 : 4;
  return Math.min(requested ?? 1, reachable) as BookingStep;
}

export function bookingHref(step: BookingStep, { servicios, barbero, dia, hora }: BookingSelection): string {
  const params = new URLSearchParams({ paso: String(step) });
  for (const id of servicios) params.append("servicios", id);
  if (barbero) params.set("barbero", barbero);
  if (dia) params.set("dia", dia);
  if (hora) params.set("hora", hora);
  return `/reservar?${params}`;
}
