import { beforeEach, describe, expect, test, vi } from "vitest";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import type { Customer } from "@/core/entities/customer";
import { type ConfirmationCycleDeps, ConfirmationCycleUseCase, REMINDER_TEMPLATE } from "./confirmation-cycle";

const lima = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00-05:00`);
const START = lima("16:00");
const PEDRO: Customer = { id: "c1", name: "Pedro", phone: "51900000001" };

const book = (id: string, start = START) =>
  Appointment.book({
    id,
    barberId: "b1",
    customerId: PEDRO.id,
    customerName: PEDRO.name,
    start,
    bookedAt: new Date("2026-11-01T00:00:00Z"),
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

function makeDeps() {
  const appointments = new Map<string, Appointment>();
  const reminded = new Set<string>();
  const confirmations: BookingConfirmation[] = [];
  const sendTemplate = vi.fn<(phone: string, template: string, parameters: readonly string[], buttons?: readonly string[]) => Promise<void>>(
    async () => {},
  );
  const notifyAtRisk = vi.fn<(a: Appointment) => Promise<unknown>>(async () => ({}));
  const clock = { now: lima("15:00") };
  const deps: ConfirmationCycleDeps = {
    appointments: {
      findById: async (id) => appointments.get(id) ?? null,
      findInRange: async () => [],
      findByStatusFrom: async (status, from) => [...appointments.values()].filter((a) => a.status === status && a.slot.end > from),
      findByBarberInRange: async () => [],
      findByCustomerFrom: async () => [],
      save: async () => {},
      updateStatus: async (a, expected) => {
        if (appointments.get(a.id)?.status !== expected) return false;
        appointments.set(a.id, a);
        return true;
      },
      claimReminder: async (id) => {
        if (reminded.has(id) || appointments.get(id)?.status !== AppointmentStatus.PENDING) return false;
        reminded.add(id);
        return true;
      },
      releaseReminder: async (id) => {
        reminded.delete(id);
      },
    },
    customers: {
      findByIds: async (ids) => [PEDRO].filter((c) => ids.includes(c.id)),
      findByPhone: async () => null,
      save: async (c) => c,
    },
    confirmations: {
      save: async () => {},
      findByCode: async () => [],
      findByAppointments: async (ids) => confirmations.filter((c) => ids.includes(c.appointmentId)),
    },
    messaging: { sendText: async () => {}, sendTemplate },
    alerts: { notifyAtRisk },
    now: () => clock.now,
  };
  const pending = (id: string, start = START) => {
    appointments.set(id, book(id, start));
    confirmations.push({ appointmentId: id, code: "KRT482", confirmBy: new Date(start.getTime() - 15 * 60_000) });
  };
  return { deps, appointments, reminded, sendTemplate, notifyAtRisk, clock, pending };
}

let t: ReturnType<typeof makeDeps>;
let cycle: ConfirmationCycleUseCase;
const at = async (hhmm: string) => {
  t.clock.now = lima(hhmm);
  return cycle.run();
};
const status = (id = "a1") => t.appointments.get(id)?.status;

beforeEach(() => {
  t = makeDeps();
  cycle = new ConfirmationCycleUseCase(t.deps);
});

describe("A) aviso de -35 min", () => {
  test("a los 35 min pide confirmar con botones que traen su código, una sola vez", async () => {
    t.pending("a1");
    expect(await at("15:24")).toMatchObject({ reminded: 0 }); // faltan 36
    expect(await at("15:25")).toEqual({ reminded: 1, atRisk: 0, expired: 0, failed: 0 });
    expect(t.sendTemplate).toHaveBeenCalledWith(PEDRO.phone, REMINDER_TEMPLATE, ["Pedro", "16:00", "15:45"], [
      "Confirmo mi cita KRT482",
      "Cancelar KRT482",
    ]);
    expect(await at("15:30")).toMatchObject({ reminded: 0 });
    expect(t.sendTemplate).toHaveBeenCalledTimes(1);
    expect(status()).toBe(AppointmentStatus.PENDING);
  });

  test("si el aviso no sale, el próximo ciclo lo reintenta", async () => {
    t.pending("a1");
    t.sendTemplate.mockRejectedValueOnce(new Error("Meta caído"));
    expect(await at("15:25")).toMatchObject({ reminded: 0, failed: 1 });
    expect(await at("15:30")).toMatchObject({ reminded: 1, failed: 0 });
  });

  test("una confirmada o sin código no recibe aviso", async () => {
    t.appointments.set("sin-codigo", book("sin-codigo"));
    t.pending("a1");
    t.appointments.set("a1", book("a1").changeStatus(AppointmentStatus.CONFIRMED));
    expect(await at("15:30")).toMatchObject({ reminded: 0 });
    expect(t.sendTemplate).not.toHaveBeenCalled();
  });
});

describe("B) liberación condicional a los -15 min", () => {
  test("si sigue pendiente pasa a en riesgo y se avisa al barbero", async () => {
    t.pending("a1");
    expect(await at("15:44")).toMatchObject({ atRisk: 0 }); // faltan 16
    expect(await at("15:45")).toMatchObject({ atRisk: 1 });
    expect(status()).toBe(AppointmentStatus.AT_RISK);
    expect(t.notifyAtRisk).toHaveBeenCalledWith(expect.objectContaining({ id: "a1", status: AppointmentStatus.AT_RISK }));
  });

  test("si el cliente confirmó, no se toca", async () => {
    t.pending("a1");
    t.appointments.set("a1", book("a1").changeStatus(AppointmentStatus.CONFIRMED));
    expect(await at("15:50")).toMatchObject({ atRisk: 0 });
    expect(status()).toBe(AppointmentStatus.CONFIRMED);
  });

  test("una pendiente que ya empezó no se pone en riesgo: la decide el barbero", async () => {
    t.pending("a1");
    expect(await at("16:05")).toMatchObject({ atRisk: 0, expired: 0 });
    expect(status()).toBe(AppointmentStatus.PENDING);
  });

  test("sin WhatsApp nadie pudo confirmar: nada se pone en riesgo ni se avisa", async () => {
    t.pending("a1");
    const off = new ConfirmationCycleUseCase({ ...t.deps, messaging: null });
    t.clock.now = lima("15:50");
    expect(await off.run()).toEqual({ reminded: 0, atRisk: 0, expired: 0, failed: 0 });
    expect(status()).toBe(AppointmentStatus.PENDING);
  });
});

describe("C) vencimiento", () => {
  test("a su hora, si sigue en riesgo, vence; antes, no", async () => {
    t.pending("a1");
    await at("15:50");
    expect(await at("15:59")).toMatchObject({ expired: 0 });
    expect(await at("16:00")).toMatchObject({ expired: 1 });
    expect(status()).toBe(AppointmentStatus.EXPIRED);
  });

  test("también vence una en riesgo que ya terminó", async () => {
    t.pending("a1");
    await at("15:50");
    expect(await at("17:00")).toMatchObject({ expired: 1 });
  });

  test("si confirmó estando en riesgo (salvado por la campana), no vence", async () => {
    t.pending("a1");
    await at("15:50");
    t.appointments.set("a1", t.appointments.get("a1")!.changeStatus(AppointmentStatus.CONFIRMED));
    expect(await at("16:00")).toMatchObject({ expired: 0 });
    expect(status()).toBe(AppointmentStatus.CONFIRMED);
  });
});

test("recorrido completo: aviso, en riesgo y vencida", async () => {
  t.pending("a1");
  expect(await at("15:25")).toMatchObject({ reminded: 1 });
  expect(await at("15:45")).toMatchObject({ atRisk: 1 });
  expect(await at("16:00")).toMatchObject({ expired: 1 });
  expect(status()).toBe(AppointmentStatus.EXPIRED);
});
