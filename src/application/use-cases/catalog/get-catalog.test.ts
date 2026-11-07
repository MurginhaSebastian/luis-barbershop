import { expect, test } from "vitest";
import { GetCatalogUseCase } from "./get-catalog";

test("devuelve lo activo y el horario de los 7 días, con el domingo en la posición 0", async () => {
  const sunday = [{ openMinute: 600, closeMinute: 720 }];
  const service = { id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000, active: true };
  const product = { id: "p1", name: "Cera", priceCents: 2500, active: true };
  const barber = { id: "b1", name: "Luis", active: true };

  const catalog = await new GetCatalogUseCase({
    services: { findAllActive: async () => [service], findByIds: async () => [], findAll: async () => [], save: async () => {} },
    products: { findAllActive: async () => [product], findByIds: async () => [], findAll: async () => [], save: async () => {} },
    barbers: {
      findAllActive: async () => [barber],
      findById: async () => null,
      findByIds: async () => [],
      findAll: async () => [],
      save: async () => {},
    },
    schedule: {
      findBusinessHours: async (weekday) => (weekday === 0 ? sunday : []),
      findBlocks: async () => [],
      saveBusinessHours: async () => {},
      findBlocksFrom: async () => [],
      addBlock: async () => {},
      removeBlock: async () => {},
    },
  }).execute();

  expect(catalog).toEqual({
    services: [service],
    products: [product],
    barbers: [barber],
    weeklyHours: [sunday, [], [], [], [], [], []],
  });
});
