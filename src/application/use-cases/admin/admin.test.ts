import { beforeEach, describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { Barber, Product, ScheduleBlock, Service } from "@/core/entities/catalog";
import { TimeSlot } from "@/core/entities/time-slot";
import { InvalidCatalogError, NotFoundError } from "@/core/errors/domain-errors";
import type { BusinessHours } from "@/core/scheduling/availability";
import { ManageCatalogUseCase } from "./manage-catalog";
import { ManageScheduleUseCase } from "./manage-schedule";

const NOW = new Date("2026-11-02T14:00:00Z");
const at = (iso: string) => new Date(iso);
const slot = (from: string, to: string) => TimeSlot.create(at(from), at(to));

const appointment = (id: string, barberId: string, start: string) =>
  Appointment.book({
    id,
    barberId,
    customerId: "c1",
    customerName: "Pedro",
    start: at(start),
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

function store<T extends { id: string }>(items: T[]) {
  return {
    findAll: async () => items,
    findAllActive: async () => items,
    findByIds: async (ids: readonly string[]) => items.filter((i) => ids.includes(i.id)),
    findById: async (id: string) => items.find((i) => i.id === id) ?? null,
    save: async (item: T) => {
      const index = items.findIndex((i) => i.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
    },
  };
}

function makeRepos() {
  const services: Service[] = [];
  const products: Product[] = [];
  const barbers: Barber[] = [{ id: "b1", name: "Luis", active: true }, { id: "b2", name: "Ana", active: true }];
  const appointments: Appointment[] = [];
  const blocks: ScheduleBlock[] = [];
  const hours = new Map<number, BusinessHours[]>();
  return {
    data: { services, products, barbers, appointments, blocks, hours },
    services: store(services),
    products: store(products),
    barbers: store(barbers),
    appointments: {
      findById: async () => null,
      findInRange: async (range: TimeSlot) => appointments.filter((a) => a.slot.overlaps(range)),
      findByStatusFrom: async () => [],
      findByBarberInRange: async (barberId: string, range: TimeSlot) =>
        appointments.filter((a) => a.barberId === barberId && a.slot.overlaps(range)),
      findByCustomerFrom: async () => [],
      save: async () => {},
      updateStatus: async () => false,
    },
    schedule: {
      findBusinessHours: async (weekday: number) => hours.get(weekday) ?? [],
      saveBusinessHours: async (weekday: number, day: readonly BusinessHours[]) => void hours.set(weekday, [...day]),
      findBlocks: async () => [],
      findBlocksFrom: async (from: Date) => blocks.filter((b) => b.slot.end > from),
      addBlock: async (block: ScheduleBlock) => void blocks.push(block),
      removeBlock: async (id: string) => void blocks.splice(blocks.findIndex((b) => b.id === id), 1),
    },
    now: () => NOW,
  };
}

let repos: ReturnType<typeof makeRepos>;
let catalog: ManageCatalogUseCase;
let schedule: ManageScheduleUseCase;

beforeEach(() => {
  repos = makeRepos();
  catalog = new ManageCatalogUseCase(repos);
  schedule = new ManageScheduleUseCase(repos);
});

describe("catálogo", () => {
  const service = { name: "  Corte  ", durationMinutes: 30, priceCents: 3000, active: true };

  test("un alta genera id y limpia el nombre", async () => {
    await catalog.saveService(service);
    expect(repos.data.services[0]).toMatchObject({ name: "Corte", priceCents: 3000 });
    expect(repos.data.services[0].id).toBeTruthy();
  });

  test("editar conserva el id y no crea otro", async () => {
    await catalog.saveService(service);
    const { id } = repos.data.services[0];
    await catalog.saveService({ ...service, id, priceCents: 3500 });
    expect(repos.data.services).toHaveLength(1);
    expect(repos.data.services[0].priceCents).toBe(3500);
  });

  test("lo inválido no se guarda", async () => {
    await expect(catalog.saveService({ ...service, priceCents: -1 })).rejects.toThrow(InvalidCatalogError);
    await expect(catalog.saveProduct({ name: "", priceCents: 100, active: true })).rejects.toThrow(InvalidCatalogError);
    await expect(catalog.saveBarber({ name: "", active: true })).rejects.toThrow(InvalidCatalogError);
    expect(repos.data.services).toEqual([]);
    expect(repos.data.products).toEqual([]);
    expect(repos.data.barbers).toHaveLength(2);
  });

  test("ocultar un barbero avisa de sus citas futuras activas, sin contar las canceladas", async () => {
    repos.data.appointments.push(
      appointment("a1", "b1", "2026-11-03T15:00:00Z"),
      Appointment.restore({ ...appointment("a2", "b1", "2026-11-04T15:00:00Z"), status: AppointmentStatus.CANCELLED }),
      appointment("a3", "b2", "2026-11-03T15:00:00Z"),
    );
    expect(await catalog.saveBarber({ id: "b1", name: "Luis", active: false })).toEqual({ upcoming: 1 });
    expect(repos.data.barbers[0].active).toBe(false);
  });

  test("un barbero activo no genera aviso", async () => {
    repos.data.appointments.push(appointment("a1", "b1", "2026-11-03T15:00:00Z"));
    expect(await catalog.saveBarber({ id: "b1", name: "Luis", active: true })).toEqual({ upcoming: 0 });
  });
});

describe("horario", () => {
  test("guarda los tramos de un día y deja el resto igual", async () => {
    const day = [{ openMinute: 600, closeMinute: 840 }];
    await schedule.saveDayHours(1, day);
    expect((await schedule.getWeeklyHours())[1]).toEqual(day);
    expect((await schedule.getWeeklyHours())[2]).toEqual([]);
  });

  test("rechaza días y tramos inválidos sin guardar", async () => {
    await expect(schedule.saveDayHours(7, [])).rejects.toThrow(InvalidCatalogError);
    await expect(schedule.saveDayHours(1, [{ openMinute: 900, closeMinute: 600 }])).rejects.toThrow(InvalidCatalogError);
    expect(repos.data.hours.size).toBe(0);
  });
});

describe("bloqueos", () => {
  const tomorrow = slot("2026-11-03T05:00:00Z", "2026-11-04T05:00:00Z");

  test("avisa de las citas que pisa, solo las de ese barbero", async () => {
    repos.data.appointments.push(appointment("a1", "b1", "2026-11-03T15:00:00Z"), appointment("a2", "b2", "2026-11-03T15:00:00Z"));
    expect(await schedule.addBlock({ barberId: "b1", slot: tomorrow, reason: null })).toEqual({ conflicts: 1 });
  });

  test("un bloqueo de toda la barbería cuenta las de todos, menos las canceladas", async () => {
    repos.data.appointments.push(
      appointment("a1", "b1", "2026-11-03T15:00:00Z"),
      appointment("a2", "b2", "2026-11-03T15:00:00Z"),
      Appointment.restore({ ...appointment("a3", "b2", "2026-11-03T16:00:00Z"), status: AppointmentStatus.CANCELLED }),
    );
    expect(await schedule.addBlock({ barberId: null, slot: tomorrow, reason: "Feriado" })).toEqual({ conflicts: 2 });
  });

  test("no acepta un periodo pasado ni un barbero que no existe", async () => {
    const past = slot("2026-11-01T05:00:00Z", "2026-11-02T05:00:00Z");
    await expect(schedule.addBlock({ barberId: null, slot: past, reason: null })).rejects.toThrow(InvalidCatalogError);
    await expect(schedule.addBlock({ barberId: "nadie", slot: tomorrow, reason: null })).rejects.toThrow(NotFoundError);
    expect(repos.data.blocks).toEqual([]);
  });

  test("lista los vigentes por fecha, con el nombre del barbero, y se pueden quitar", async () => {
    await schedule.addBlock({ barberId: null, slot: slot("2026-11-05T05:00:00Z", "2026-11-06T05:00:00Z"), reason: "Feriado" });
    await schedule.addBlock({ barberId: "b1", slot: tomorrow, reason: null });

    const list = await schedule.listBlocks();
    expect(list.map((b) => b.barberName)).toEqual(["Luis", null]);
    expect(list[1].reason).toBe("Feriado");

    await schedule.removeBlock(list[0].id);
    expect(await schedule.listBlocks()).toHaveLength(1);
  });
});
