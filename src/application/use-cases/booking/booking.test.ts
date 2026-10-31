import { beforeEach, describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { Barber, Product, Service } from "@/core/entities/catalog";
import type { Customer } from "@/core/entities/customer";
import { TimeSlot } from "@/core/entities/time-slot";
import { BookingWindowError, InvalidAppointmentError, NotFoundError, SlotUnavailableError } from "@/core/errors/domain-errors";
import type { BusinessHours } from "@/core/scheduling/availability";
import { CreateAppointmentUseCase } from "./create-appointment";
import { GetAvailableSlotsUseCase } from "./get-available-slots";

// Datos ficticios. Lunes 2026-11-02, Lima 10:00–13:00 = 15:00–18:00 UTC.
const NOW = new Date("2026-11-01T12:00:00Z");
const DATE = "2026-11-02";
const utc = (hhmm: string) => new Date(`${DATE}T${hhmm}:00Z`);
const starts = (slots: TimeSlot[]) => slots.map((s) => s.start.toISOString().slice(11, 16));

function makeRepos() {
  const barbers: Barber[] = [
    { id: "b1", name: "Barbero A", active: true },
    { id: "b2", name: "Barbero B", active: true },
  ];
  const services: Service[] = [
    { id: "corte", name: "Corte", durationMinutes: 30, priceCents: 3000, active: true },
    { id: "barba", name: "Barba", durationMinutes: 30, priceCents: 2000, active: true },
    { id: "viejo", name: "Retirado", durationMinutes: 30, priceCents: 1000, active: false },
  ];
  const products: Product[] = [{ id: "cera", name: "Cera", priceCents: 2500, active: true }];
  const hours: BusinessHours[] = [{ openMinute: 600, closeMinute: 780 }];
  const blocks: { barberId: string | null; slot: TimeSlot }[] = [];
  const appointments: Appointment[] = [];
  const customers: Customer[] = [];

  return {
    data: { blocks, appointments, customers },
    barbers: {
      findById: async (id: string) => barbers.find((b) => b.id === id) ?? null,
      findAllActive: async () => barbers.filter((b) => b.active),
    },
    services: {
      findByIds: async (ids: readonly string[]) => services.filter((s) => ids.includes(s.id)),
      findAllActive: async () => services.filter((s) => s.active),
    },
    products: {
      findByIds: async (ids: readonly string[]) => products.filter((p) => ids.includes(p.id)),
      findAllActive: async () => products.filter((p) => p.active),
    },
    customers: {
      findByPhone: async (phone: string) => customers.find((c) => c.phone === phone) ?? null,
      save: async (c: Customer) => {
        const existing = customers.find((x) => x.phone === c.phone);
        if (existing) return existing;
        customers.push(c);
        return c;
      },
    },
    schedule: {
      findBusinessHours: async (weekday: number) => (weekday === 1 ? hours : []),
      findBlocks: async (barberId: string, range: TimeSlot) =>
        blocks.filter((b) => (b.barberId === null || b.barberId === barberId) && b.slot.overlaps(range)).map((b) => b.slot),
    },
    appointments: {
      findByBarberInRange: async (barberId: string, range: TimeSlot) =>
        appointments.filter((a) => a.barberId === barberId && a.slot.overlaps(range)),
      save: async (a: Appointment) => void appointments.push(a),
    },
    now: () => NOW,
  };
}

let repos: ReturnType<typeof makeRepos>;
let getSlots: GetAvailableSlotsUseCase;
let create: CreateAppointmentUseCase;

beforeEach(() => {
  repos = makeRepos();
  getSlots = new GetAvailableSlotsUseCase(repos);
  create = new CreateAppointmentUseCase(repos);
});

const book = (overrides: Partial<Parameters<CreateAppointmentUseCase["execute"]>[0]> = {}) =>
  create.execute({
    barberId: "b1",
    serviceIds: ["corte"],
    customer: { name: "Cliente Prueba", phone: "900 000 001" },
    start: utc("15:00"),
    ...overrides,
  });

describe("GetAvailableSlotsUseCase", () => {
  test("la duración es la suma de los servicios elegidos", async () => {
    const slots = await getSlots.execute({ barberId: "b1", serviceIds: ["corte", "barba"], date: DATE });
    expect(starts(slots)).toEqual(["15:00", "15:30", "16:00", "16:30", "17:00"]);
  });

  test("las citas activas ocupan el hueco y las canceladas lo liberan", async () => {
    const taken = await book({ start: utc("15:30") });
    const cancelled = await book({ start: utc("16:30"), customer: { name: "Otro", phone: "900000002" } });
    repos.data.appointments.splice(repos.data.appointments.indexOf(cancelled), 1,
      Appointment.restore({ ...cancelled, status: AppointmentStatus.CANCELLED }));

    const slots = await getSlots.execute({ barberId: "b1", serviceIds: ["corte"], date: DATE });
    expect(taken.status).toBe(AppointmentStatus.PENDING);
    expect(starts(slots)).toEqual(["15:00", "16:00", "16:30", "17:00", "17:30"]);
    // La agenda de otro barbero no se ve afectada.
    expect(await getSlots.execute({ barberId: "b2", serviceIds: ["corte"], date: DATE })).toHaveLength(6);
  });

  test("bloqueos del barbero y de toda la barbería", async () => {
    repos.data.blocks.push({ barberId: "b1", slot: TimeSlot.create(utc("15:00"), utc("16:00")) });
    repos.data.blocks.push({ barberId: null, slot: TimeSlot.create(utc("17:00"), utc("18:00")) });

    expect(starts(await getSlots.execute({ barberId: "b1", serviceIds: ["corte"], date: DATE }))).toEqual(["16:00", "16:30"]);
    expect(starts(await getSlots.execute({ barberId: "b2", serviceIds: ["corte"], date: DATE }))).toEqual(["15:00", "15:30", "16:00", "16:30"]);
  });

  test("día cerrado, barbero o servicio inexistente o inactivo", async () => {
    expect(await getSlots.execute({ barberId: "b1", serviceIds: ["corte"], date: "2026-11-03" })).toEqual([]);
    await expect(getSlots.execute({ barberId: "nadie", serviceIds: ["corte"], date: DATE })).rejects.toThrow(NotFoundError);
    await expect(getSlots.execute({ barberId: "b1", serviceIds: ["viejo"], date: DATE })).rejects.toThrow(NotFoundError);
  });
});

describe("CreateAppointmentUseCase", () => {
  test("guarda la cita PENDING con foto de precios y productos", async () => {
    const a = await book({ serviceIds: ["corte", "barba"], products: [{ productId: "cera", quantity: 1 }] });
    expect(repos.data.appointments).toEqual([a]);
    expect(a.slot.end).toEqual(utc("16:00"));
    expect(a.totalCents).toBe(3000 + 2000 + 2500);
  });

  test("rechaza solapamientos, inicios desalineados y fuera de horario", async () => {
    await book();
    await expect(book({ start: utc("15:00"), customer: { name: "Otro", phone: "900000002" } })).rejects.toThrow(SlotUnavailableError);
    await expect(book({ start: utc("16:15") })).rejects.toThrow(SlotUnavailableError);
    await expect(book({ start: utc("17:45") })).rejects.toThrow(SlotUnavailableError); // no cabe antes del cierre
    expect(repos.data.appointments).toHaveLength(1);
  });

  test("rechaza reservas fuera de la ventana", async () => {
    await expect(book({ start: new Date("2026-11-01T12:30:00Z") })).rejects.toThrow(BookingWindowError);
    await expect(book({ start: new Date("2026-12-07T15:00:00Z") })).rejects.toThrow(BookingWindowError);
  });

  test("reconoce al cliente por teléfono aunque lo escriba distinto", async () => {
    const first = await book({ customer: { name: "Cliente Prueba", phone: "900 000 001" } });
    const second = await book({ start: utc("16:00"), customer: { name: "Cliente", phone: "+51 900-000-001" } });
    expect(second.customerId).toBe(first.customerId);
    expect(repos.data.customers).toHaveLength(1);
  });

  test("sin servicios, sea el día que sea", async () => {
    await expect(book({ serviceIds: [] })).rejects.toThrow(InvalidAppointmentError);
    await expect(getSlots.execute({ barberId: "b1", serviceIds: [], date: "2026-11-03" })).rejects.toThrow(InvalidAppointmentError);
  });

  test("producto inexistente", async () => {
    await expect(book({ products: [{ productId: "nada", quantity: 1 }] })).rejects.toThrow(NotFoundError);
  });
});
