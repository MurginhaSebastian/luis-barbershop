import type { Barber, Service, ServiceArea } from "../entities/catalog";
import { InvalidAppointmentError, InvalidCatalogError } from "../errors/domain-errors";
import type { BusinessHours } from "../scheduling/availability";

const DAY_MINUTES = 1440;
const MIN_NAME = 2;
const MAX_NAME = 60;
const MAX_DURATION_MINUTES = 240;
const DURATION_STEP_MINUTES = 5;
const MAX_PRICE_CENTS = 10_000_00;

function assertValidName(name: string) {
  const { length } = name.trim();
  if (length < MIN_NAME || length > MAX_NAME) {
    throw new InvalidCatalogError(`El nombre debe tener entre ${MIN_NAME} y ${MAX_NAME} caracteres.`);
  }
}

function assertValidPrice(priceCents: number) {
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > MAX_PRICE_CENTS) {
    throw new InvalidCatalogError("El precio no es válido.");
  }
}

export function assertValidService(service: { name: string; durationMinutes: number; priceCents: number; active?: boolean }) {
  assertValidName(service.name);
  assertValidPrice(service.priceCents);
  if (service.active && service.priceCents === 0) throw new InvalidCatalogError("Pon un precio antes de mostrar el servicio.");
  const { durationMinutes } = service;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes > MAX_DURATION_MINUTES ||
    durationMinutes % DURATION_STEP_MINUTES !== 0
  ) {
    throw new InvalidCatalogError(`La duración debe ir de ${DURATION_STEP_MINUTES} en ${DURATION_STEP_MINUTES} minutos, hasta ${MAX_DURATION_MINUTES}.`);
  }
}

export function assertValidProduct(product: { name: string; priceCents: number }) {
  assertValidName(product.name);
  assertValidPrice(product.priceCents);
}

export function assertValidBarber(barber: { name: string; areas?: readonly string[] }) {
  assertValidName(barber.name);
  if (barber.areas?.length === 0) throw new InvalidCatalogError("Elige al menos un área.");
}

/** El dueño conserva su nombre y sigue visible. */
export function assertBarberChange(current: Barber, next: { name: string; active: boolean }) {
  if (current.isOwner && (next.name.trim() !== current.name || !next.active)) {
    throw new InvalidCatalogError("El dueño no se puede renombrar ni ocultar.");
  }
}

/** Los tramos de un día: cada uno abre antes de cerrar y no pisa a otro. Tocarse sí vale. */
export function assertValidHours(hours: readonly BusinessHours[]) {
  const sorted = hours.toSorted((a, b) => a.openMinute - b.openMinute);
  sorted.forEach(({ openMinute, closeMinute }, i) => {
    if (openMinute < 0 || closeMinute > DAY_MINUTES || openMinute >= closeMinute) {
      throw new InvalidCatalogError("La hora de cierre debe ser posterior a la de apertura.");
    }
    if (i > 0 && openMinute < sorted[i - 1].closeMinute) {
      throw new InvalidCatalogError("Los tramos del día no pueden pisarse.");
    }
  });
}

/** El área común de los servicios de una cita; no se mezclan Barbería y Spa y estilista. */
export function bookingArea(services: readonly Service[]): ServiceArea {
  const areas = new Set(services.map((s) => s.area ?? "barberia"));
  if (areas.size > 1) throw new InvalidAppointmentError("Reserva por separado los servicios de Barbería y de Spa y estilista.");
  return [...areas][0] ?? "barberia";
}
