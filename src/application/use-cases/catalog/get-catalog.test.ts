import { expect, test } from "vitest";
import type { ScheduleBlock } from "@/core/entities/catalog";
import { TimeSlot } from "@/core/entities/time-slot";
import { GetCatalogUseCase, type GetCatalogDeps } from "./get-catalog";

test("devuelve lo activo y el horario de los 7 días, con el domingo en la posición 0", async () => {
  const sunday = [{ openMinute: 600, closeMinute: 720 }];
  const service = { id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000, active: true };
  const product = { id: "p1", name: "Cera", priceCents: 2500, active: true };
  const barber = { id: "b1", name: "Luis", active: true };

  const catalog = await new GetCatalogUseCase({
    now: () => new Date(),
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

test("el estado de hoy descuenta los cierres de toda la barbería, no los de un barbero", async () => {
  const lima = (hhmm: string) => new Date(`2026-11-09T${hhmm}:00-05:00`); // lunes
  const block = (barberId: string | null, from: string, to: string): ScheduleBlock => ({
    id: from,
    barberId,
    slot: TimeSlot.create(lima(from), lima(to)),
    reason: null,
  });
  const deps = (blocks: ScheduleBlock[]) =>
    ({
      now: () => lima("11:00"),
      schedule: {
        findBusinessHours: async (weekday: number) => (weekday === 1 ? [{ openMinute: 600, closeMinute: 1200 }] : []),
        findBlocksFrom: async () => blocks,
      },
    }) as unknown as GetCatalogDeps;

  expect(await new GetCatalogUseCase(deps([block("b1", "10:00", "13:00")])).openingStatus()).toEqual({ open: true, until: lima("20:00") });
  expect(await new GetCatalogUseCase(deps([block(null, "10:00", "13:00")])).openingStatus()).toEqual({ open: false, opensAt: lima("13:00") });
});
