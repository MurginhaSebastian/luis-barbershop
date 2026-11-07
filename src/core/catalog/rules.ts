import { InvalidCatalogError } from "../errors/domain-errors";
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

export function assertValidService(service: { name: string; durationMinutes: number; priceCents: number }) {
  assertValidName(service.name);
  assertValidPrice(service.priceCents);
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

export function assertValidBarber(barber: { name: string }) {
  assertValidName(barber.name);
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
