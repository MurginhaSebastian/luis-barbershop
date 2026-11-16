import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import { shopIso } from "@/application/shop-time";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { Barber, Service } from "@/core/entities/catalog";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import type { Customer } from "@/core/entities/customer";
import { SlotUnavailableError } from "@/core/errors/domain-errors";
import type { TimeSlot } from "@/core/entities/time-slot";
import { DEFAULT_SITE_SETTINGS } from "@/core/entities/site";
import { BookingConfirmationUseCase } from "../booking/booking-confirmation";
import { CreateAppointmentUseCase } from "../booking/create-appointment";
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
  const confirmations: BookingConfirmation[] = [];
  const clock = { now: NOW };
  const sendTemplate = vi.fn<(phone: string, template: string, parameters: readonly string[]) => Promise<void>>(async () => {});
  const report = { sent: 1, removed: 0, failed: 0 };
  const push = {
    notifyNewBooking: vi.fn<(a: Appointment) => Promise<typeof report>>(async () => report),
    notifyConfirmed: vi.fn<(a: Appointment) => Promise<typeof report>>(async () => report),
    notifyCancelled: vi.fn<(a: Appointment) => Promise<typeof report>>(async () => report),
  };

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
    confirmations: {
      save: async (c: BookingConfirmation) => void confirmations.push(c),
      findByCode: async (code: string) => confirmations.filter((c) => c.code === code),
      findByAppointments: async (ids: readonly string[]) => confirmations.filter((c) => ids.includes(c.appointmentId)),
    },
    processedMessages: { wasProcessed: async () => false, markProcessed: async () => {} },
    siteSettings: { get: async () => DEFAULT_SITE_SETTINGS, save: async () => {} },
    messaging: { sendText: async () => {}, sendTemplate },
    confirmationNumber: "51911111111",
    now: () => clock.now,
    randomBytes: (n: number) => new Uint8Array(n),
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
  const executor = () => {
    const availability = new GetAvailableSlotsUseCase(deps);
    return new BotToolExecutor({
      ...deps,
      availability,
      booking: new CreateAppointmentUseCase(deps),
      confirmation: new BookingConfirmationUseCase(deps),
      push,
    });
  };
  return { deps, appointments, reminded, confirmations, clock, sendTemplate, push, book, executor };
}

let w: ReturnType<typeof makeWorld>;
let bot: BotToolExecutor;
// Un solo reloj para el contexto y para los casos de uso: si no, la regla de 35 min y "futuras" no coinciden.
const me = (): ToolContext => ({ verifiedPhone: ME, now: w.clock.now });
const call = (name: string, args: unknown = {}, context = me()) => bot.executeTool({ name, arguments: args }, context);
const at = (hhmm: string) => {
  w.clock.now = lima(hhmm);
};
const statusOf = (key: string) => w.appointments.get(key)?.status;

beforeEach(() => {
  w = makeWorld();
  bot = w.executor();
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

describe("reservar_cita", () => {
  const reserve = (startTime: string, extra: Record<string, unknown> = {}) =>
    call("reservar_cita", { customerName: "Pedro", serviceIds: [CORTE], barberId: LUIS, startTime, ...extra });

  test("una hora devuelta por consultar_huecos_dinamicos se puede reservar tal cual, con el celular del chat", async () => {
    const free = await call("consultar_huecos_dinamicos", { serviceIds: [CORTE], date: "2026-11-12", barberId: LUIS });
    const startTime = (free as { data: { slots: { startTime: string }[] } }).data.slots[2].startTime; // 11:00
    const result = await reserve(startTime);
    expect(result).toMatchObject({
      ok: true,
      data: { appointment: { startTime: "2026-11-12T11:00:00-05:00", status: "PENDING", barberName: "Luis" }, next: expect.stringContaining("35 minutos") },
    });
    const [booked] = [...w.appointments.values()];
    expect(booked.customerId).toBe(id(21)); // Pedro: el dueño de ME
    // Nace pendiente con código: así entra en el ciclo de -35 / -15 min.
    expect(w.confirmations.map((c) => c.appointmentId)).toEqual([booked.id]);
    expect(w.push.notifyNewBooking).toHaveBeenCalledWith(booked);
  });

  test("con menos de 2 h nace confirmada y sin código", async () => {
    at("09:30");
    expect(await reserve("2026-11-12T11:00:00-05:00")).toMatchObject({ ok: true, data: { appointment: { status: "CONFIRMED" } } });
    expect(w.confirmations).toEqual([]);
  });

  test("tomar una hora en riesgo la vence y avisa a su cliente, como en la web", async () => {
    w.book(id(31), OTHER, lima("10:00"), AppointmentStatus.AT_RISK);
    at("09:50");
    expect(await reserve("2026-11-12T10:00:00-05:00")).toMatchObject({ ok: true, data: { appointment: { status: "CONFIRMED" } } });
    expect(statusOf(id(31))).toBe(AppointmentStatus.EXPIRED);
    expect(w.sendTemplate).toHaveBeenCalledWith(OTHER, "cita_vencida", ["Otro", expect.stringContaining("10:00")]);
  });

  test("un celular que mande el modelo se ignora: vale el del chat", async () => {
    expect(await reserve("2026-11-12T11:00:00-05:00", { customerPhone: OTHER })).toMatchObject({ ok: true });
    expect([...w.appointments.values()][0].customerId).toBe(id(21)); // Pedro, el dueño de ME
  });

  test("si un aviso falla, la reserva vale igual y se cuenta", async () => {
    w.push.notifyNewBooking.mockRejectedValueOnce(new Error("push caído"));
    expect(await reserve("2026-11-12T11:00:00-05:00")).toMatchObject({ ok: true, failedNotices: 1 });
  });

  test("una hora ocupada es un error de negocio", async () => {
    w.book(id(31), OTHER, lima("11:00"));
    expect(await reserve("2026-11-12T11:00:00-05:00")).toMatchObject({ ok: false, error: "DOMAIN_ERROR" });
  });

  test("una hora sin desfase o un nombre vacío se rechazan", async () => {
    expect(await reserve("12/11/2026 11:00")).toMatchObject({ ok: false, error: "INVALID_ARGUMENTS" });
    expect(await reserve("2026-11-12T11:00:00-05:00", { customerName: " " })).toMatchObject({ ok: false, error: "INVALID_ARGUMENTS" });
  });
});

describe("confirmar_asistencia", () => {
  test("con una sola cita pendiente, confirma esa y avisa al barbero", async () => {
    w.book(id(31), ME, lima("11:00"));
    expect(await call("confirmar_asistencia")).toMatchObject({ ok: true, data: { appointment: { id: id(31), status: "CONFIRMED" } } });
    expect(statusOf(id(31))).toBe(AppointmentStatus.CONFIRMED);
    expect(w.push.notifyConfirmed).toHaveBeenCalled();
  });

  test("la cita de otro número se rechaza igual que una que no existe", async () => {
    w.book(id(31), OTHER, lima("11:00"));
    const foreign = await call("confirmar_asistencia", { appointmentId: id(31) });
    const missing = await call("confirmar_asistencia", { appointmentId: id(99) });
    expect(foreign).toEqual(missing);
    expect(foreign).toMatchObject({ ok: false, error: "APPOINTMENT_NOT_FOUND" });
    expect(statusOf(id(31))).toBe(AppointmentStatus.PENDING);
  });

  test("con dos citas y sin decir cuál, no adivina: devuelve ambas para preguntar", async () => {
    w.book(id(31), ME, lima("11:00"));
    w.book(id(32), ME, lima("12:00"));
    const result = await call("confirmar_asistencia");
    expect(result).toMatchObject({ ok: false, error: "MULTIPLE_APPOINTMENTS_FOUND" });
    expect((result as { data: { appointments: { id: string }[] } }).data.appointments.map((a) => a.id)).toEqual([id(31), id(32)]);
    expect([statusOf(id(31)), statusOf(id(32))]).toEqual([AppointmentStatus.PENDING, AppointmentStatus.PENDING]);
    // Diciendo cuál, sí.
    expect(await call("confirmar_asistencia", { appointmentId: id(32) })).toMatchObject({ ok: true });
  });

  test("en riesgo y sin que nadie tomara la hora: salvado por la campana", async () => {
    w.book(id(31), ME, lima("10:00"), AppointmentStatus.AT_RISK);
    at("09:50");
    expect(await call("confirmar_asistencia")).toMatchObject({ ok: true, data: { appointment: { status: "CONFIRMED" } } });
  });

  test("si otro ya tomó su hora, lo dice y ofrece las 3 siguientes libres de ese día", async () => {
    w.book(id(31), ME, lima("10:00"), AppointmentStatus.EXPIRED);
    w.book(id(32), OTHER, lima("10:00"), AppointmentStatus.CONFIRMED);
    at("09:50");
    const result = await call("confirmar_asistencia");
    expect(result).toMatchObject({ ok: false, error: "SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER" });
    const { nextSlots } = (result as { data: { nextSlots: { time: string }[] } }).data;
    expect(nextSlots.map((s) => s.time)).toEqual(["10:30", "11:00", "11:30"]);
  });

  test("sin nada que confirmar no dice que otro tomó su hora: NO_APPOINTMENTS_TO_CONFIRM", async () => {
    w.book(id(31), ME, lima("09:00", "2026-11-11"), AppointmentStatus.EXPIRED); // vencida, pero de ayer
    w.book(id(32), ME, lima("11:00"), AppointmentStatus.CANCELLED);
    expect(await call("confirmar_asistencia")).toMatchObject({
      ok: false,
      error: "NO_APPOINTMENTS_TO_CONFIRM",
      message: "No tienes ninguna cita pendiente por confirmar.",
    });
  });

  test("si ya estaba confirmada, lo dice", async () => {
    w.book(id(31), ME, lima("11:00"), AppointmentStatus.CONFIRMED);
    expect(await call("confirmar_asistencia")).toMatchObject({ ok: true, data: { note: "Ya estaba confirmada." } });
  });
});

describe("cancelar_cita", () => {
  test("una cita que nació confirmada (sin código) se cancela con 35 min o más", async () => {
    w.book(id(31), ME, lima("11:00"), AppointmentStatus.CONFIRMED);
    at("10:25");
    expect(await call("cancelar_cita")).toMatchObject({ ok: true, data: { appointmentId: id(31), status: "CANCELLED" } });
    expect(w.push.notifyCancelled).toHaveBeenCalled();
  });

  test("confirmada y con menos de 35 min, no: debe avisar a la barbería", async () => {
    w.book(id(31), ME, lima("11:00"), AppointmentStatus.CONFIRMED);
    at("10:30");
    expect(await call("cancelar_cita")).toMatchObject({ ok: false, error: "CANCELLATION_TOO_LATE" });
    expect(statusOf(id(31))).toBe(AppointmentStatus.CONFIRMED);
  });

  test("sin citas activas lo dice", async () => {
    expect(await call("cancelar_cita")).toMatchObject({ ok: false, error: "NO_ACTIVE_APPOINTMENTS" });
  });

  test("con varias citas activas y sin decir cuál, pregunta", async () => {
    w.book(id(31), ME, lima("11:00"));
    w.book(id(32), ME, lima("12:00"), AppointmentStatus.CONFIRMED);
    expect(await call("cancelar_cita")).toMatchObject({ ok: false, error: "MULTIPLE_APPOINTMENTS_FOUND" });
  });

  test("no cancela la cita de otro número", async () => {
    w.book(id(31), OTHER, lima("11:00"));
    expect(await call("cancelar_cita", { appointmentId: id(31) })).toMatchObject({ ok: false, error: "APPOINTMENT_NOT_FOUND" });
    expect(statusOf(id(31))).toBe(AppointmentStatus.PENDING);
  });
});

test("shopIso: hora de Lima con desfase, también al cruzar la medianoche UTC", () => {
  expect(shopIso(new Date("2026-11-13T03:30:00Z"))).toBe("2026-11-12T22:30:00-05:00");
  expect(shopIso(new Date("2026-11-13T05:00:00Z"))).toBe("2026-11-13T00:00:00-05:00");
});
