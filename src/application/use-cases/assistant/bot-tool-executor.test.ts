import { beforeEach, describe, expect, test } from "vitest";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import { shopIso } from "@/application/shop-time";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { Barber, Service } from "@/core/entities/catalog";
import type { Customer } from "@/core/entities/customer";
import { SlotUnavailableError } from "@/core/errors/domain-errors";
import type { TimeSlot } from "@/core/entities/time-slot";
import { GetAvailableSlotsUseCase } from "../booking/get-available-slots";
import { BotToolExecutor, type ToolContext } from "./bot-tool-executor";
import { botToolDefinitions } from "./bot-tools";

// Datos ficticios. Jueves 2026-11-12, la barbería abre de 10:00 a 13:00 en Lima.
const lima = (hhmm: string, date = "2026-11-12") => new Date(`${date}T${hhmm}:00-05:00`);
const NOW = lima("08:00");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CORTE = id(1);
const CEJAS = id(2);
const RETIRADO = id(3);
const LUIS = id(11);
const ANA = id(12);
const ME = "51900000001";
const OTHER = "51900000002";

function makeWorld() {
  const services: Service[] = [
    { id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 3000, active: true },
    { id: CEJAS, name: "Cejas", durationMinutes: 15, priceCents: 1000, active: true },
    { id: RETIRADO, name: "Retirado", durationMinutes: 30, priceCents: 1000, active: false },
  ];
  const barbers: Barber[] = [
    { id: LUIS, name: "Luis", active: true },
    { id: ANA, name: "Ana", active: true },
  ];
  const customers: Customer[] = [
    { id: id(21), name: "Pedro", phone: ME },
    { id: id(22), name: "Otro", phone: OTHER },
  ];
  const appointments = new Map<string, Appointment>();
  const reminded = new Set<string>();

  const appointmentRepo: IAppointmentRepository = {
    findById: async (key) => appointments.get(key) ?? null,
    findInRange: async (range) => [...appointments.values()].filter((a) => a.slot.overlaps(range)),
    findByStatusFrom: async (status, from) => [...appointments.values()].filter((a) => a.status === status && a.slot.end > from),
    findByBarberInRange: async (barberId, range) =>
      [...appointments.values()].filter((a) => a.barberId === barberId && a.slot.overlaps(range)),
    findByCustomerFrom: async (customerId, from) =>
      [...appointments.values()].filter((a) => a.customerId === customerId && a.slot.end > from),
    save: async (a, displacing = []) => {
      for (const d of displacing) {
        if (appointments.get(d.id)?.status !== AppointmentStatus.AT_RISK) throw new SlotUnavailableError();
        appointments.set(d.id, d.changeStatus(AppointmentStatus.EXPIRED));
      }
      appointments.set(a.id, a);
    },
    updateStatus: async (a, expected) => {
      if (appointments.get(a.id)?.status !== expected) return false;
      appointments.set(a.id, a);
      return true;
    },
    claimReminder: async (key) => {
      if (reminded.has(key) || appointments.get(key)?.status !== AppointmentStatus.PENDING) return false;
      reminded.add(key);
      return true;
    },
    releaseReminder: async (key) => {
      reminded.delete(key);
    },
  };

  const deps = {
    services: {
      findByIds: async (ids: readonly string[]) => services.filter((s) => ids.includes(s.id)),
      findAllActive: async () => services.filter((s) => s.active),
      findAll: async () => services,
      save: async () => {},
    },
    barbers: {
      findById: async (key: string) => barbers.find((b) => b.id === key) ?? null,
      findByIds: async (ids: readonly string[]) => barbers.filter((b) => ids.includes(b.id)),
      findAllActive: async () => barbers.filter((b) => b.active),
      findAll: async () => barbers,
      save: async () => {},
    },
    products: { findByIds: async () => [], findAllActive: async () => [], findAll: async () => [], save: async () => {} },
    customers: {
      findByIds: async (ids: readonly string[]) => customers.filter((c) => ids.includes(c.id)),
      findByPhone: async (phone: string) => customers.find((c) => c.phone === phone) ?? null,
      save: async (c: Customer) => {
        customers.push(c);
        return c;
      },
    },
    schedule: {
      findBusinessHours: async (weekday: number) => (weekday === 4 ? [{ openMinute: 600, closeMinute: 780 }] : []),
      findBlocks: async (): Promise<TimeSlot[]> => [],
      saveBusinessHours: async () => {},
      findBlocksFrom: async () => [],
      addBlock: async () => {},
      removeBlock: async () => {},
    },
    appointments: appointmentRepo,
    now: () => NOW,
  };
  const book = (key: string, phone: string, start: Date, status: AppointmentStatus = AppointmentStatus.PENDING) => {
    const customer = customers.find((c) => c.phone === phone)!;
    const a = Appointment.book({
      id: key,
      barberId: LUIS,
      customerId: customer.id,
      customerName: customer.name,
      start,
      bookedAt: new Date("2026-11-01T00:00:00Z"),
      services: [{ serviceId: CORTE, name: "Corte", durationMinutes: 30, priceCents: 3000 }],
      products: [],
    });
    appointments.set(key, Appointment.restore({ ...a, status }));
  };
  return { deps, appointments, reminded, book };
}

let w: ReturnType<typeof makeWorld>;
let bot: BotToolExecutor;
const me: ToolContext = { verifiedPhone: ME, now: NOW };
const call = (name: string, args: unknown = {}, context = me) => bot.executeTool({ name, arguments: args }, context);

beforeEach(() => {
  w = makeWorld();
  bot = new BotToolExecutor({ ...w.deps, availability: new GetAvailableSlotsUseCase(w.deps) });
});

describe("listar_catalogo_y_mis_citas", () => {
  test("servicios y barberos activos con sus ids, y solo las citas activas de este número", async () => {
    w.book(id(31), ME, lima("11:00"));
    w.book(id(32), ME, lima("12:00"), AppointmentStatus.CANCELLED);
    w.book(id(33), OTHER, lima("10:00"));
    const result = await call("listar_catalogo_y_mis_citas");
    expect(result).toEqual({
      ok: true,
      data: {
        services: [
          { id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 3000, price: "S/ 30.00" },
          { id: CEJAS, name: "Cejas", durationMinutes: 15, priceCents: 1000, price: "S/ 10.00" },
        ],
        barbers: [
          { id: LUIS, name: "Luis" },
          { id: ANA, name: "Ana" },
        ],
        myActiveAppointments: [
          {
            id: id(31),
            startTime: "2026-11-12T11:00:00-05:00",
            endTime: "2026-11-12T11:30:00-05:00",
            when: expect.stringContaining("11:00"),
            status: "PENDING",
            barberName: "Luis",
            services: ["Corte"],
          },
        ],
      },
    });
    // Nada de otros clientes ni datos internos.
    expect(JSON.stringify(result)).not.toMatch(/5190000000|Otro|customerId/);
  });

  test("un número que nunca reservó no tiene citas", async () => {
    const result = await call("listar_catalogo_y_mis_citas", {}, { verifiedPhone: "51911111111", now: NOW });
    expect(result).toMatchObject({ ok: true, data: { myActiveAppointments: [] } });
  });
});

describe("consultar_huecos_dinamicos", () => {
  test("la duración es la suma de los servicios y las horas van en hora de Lima con su desfase", async () => {
    w.book(id(31), OTHER, lima("10:00"));
    const result = await call("consultar_huecos_dinamicos", { serviceIds: [CORTE, CEJAS], date: "2026-11-12", barberId: LUIS });
    expect(result).toMatchObject({ ok: true, data: { date: "2026-11-12", totalDurationMinutes: 45 } });
    const { slots } = (result as { data: { slots: { startTime: string; time: string }[] } }).data;
    // 10:30 justo al terminar la cita de 10:00; la última que cabe antes de las 13:00 es 12:00.
    expect(slots.map((s) => s.time)).toEqual(["10:30", "11:00", "11:30", "12:00"]);
    expect(slots[0].startTime).toBe("2026-11-12T10:30:00-05:00");
  });

  test("sin barbero es sin preferencia: cualquiera libre", async () => {
    w.book(id(31), OTHER, lima("10:00"));
    const result = await call("consultar_huecos_dinamicos", { serviceIds: [CORTE], date: "2026-11-12" });
    expect((result as { data: { slots: { time: string }[] } }).data.slots[0].time).toBe("10:00");
  });

  test("un servicio retirado es un error de negocio que el modelo puede explicar", async () => {
    expect(await call("consultar_huecos_dinamicos", { serviceIds: [RETIRADO], date: "2026-11-12" })).toMatchObject({
      ok: false,
      error: "DOMAIN_ERROR",
    });
  });
});

describe("lo que manda el modelo no es de fiar", () => {
  test.each([
    ["sin servicios", { serviceIds: [], date: "2026-11-12" }],
    ["un id que no es uuid", { serviceIds: ["corte"], date: "2026-11-12" }],
    ["una fecha mal escrita", { serviceIds: [CORTE], date: "12/11/2026" }],
    ["sin argumentos", undefined],
  ])("%s: argumentos inválidos", async (_, args) => {
    expect(await call("consultar_huecos_dinamicos", args)).toMatchObject({ ok: false, error: "INVALID_ARGUMENTS" });
  });

  test("una herramienta que no existe", async () => {
    expect(await call("borrar_base", {})).toMatchObject({ ok: false, error: "UNKNOWN_TOOL" });
    expect(await call("toString", {})).toMatchObject({ ok: false, error: "UNKNOWN_TOOL" });
  });

  test("ninguna herramienta deja al modelo elegir el celular", () => {
    const definitions = botToolDefinitions();
    expect(definitions.map((d) => d.name)).toContain("consultar_huecos_dinamicos");
    expect(JSON.stringify(definitions)).not.toMatch(/phone|celular|telefono/i);
  });
});

test("shopIso: hora de Lima con desfase, también al cruzar la medianoche UTC", () => {
  expect(shopIso(new Date("2026-11-13T03:30:00Z"))).toBe("2026-11-12T22:30:00-05:00");
  expect(shopIso(new Date("2026-11-13T05:00:00Z"))).toBe("2026-11-13T00:00:00-05:00");
});
