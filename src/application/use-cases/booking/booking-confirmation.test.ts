import { beforeEach, describe, expect, test, vi } from "vitest";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import type { Customer } from "@/core/entities/customer";
import { BookingConfirmationUseCase, type BookingConfirmationDeps } from "./booking-confirmation";

const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);
const NOW = lima("2026-11-09", "10:00");
const SHOP = "51900000000";
const PEDRO: Customer = { id: "c1", name: "Pedro", phone: "51900000001" };
const ANA: Customer = { id: "c2", name: "Ana", phone: "51900000002" };

const book = (id: string, customer: Customer) =>
  Appointment.book({
    id,
    barberId: "b1",
    customerId: customer.id,
    customerName: customer.name,
    start: lima("2026-11-12", "16:00"),
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

function makeDeps() {
  const appointments = new Map<string, Appointment>();
  const confirmations: BookingConfirmation[] = [];
  const processed = new Set<string>();
  const sendText = vi.fn<(phone: string, text: string) => Promise<void>>(async () => {});
  const sendTemplate = vi.fn<(phone: string, template: string, parameters: readonly string[]) => Promise<void>>(async () => {});
  const deps: BookingConfirmationDeps = {
    appointments: {
      findById: async (id) => appointments.get(id) ?? null,
      save: async (a) => {
        appointments.set(a.id, a);
      },
      updateStatus: async (a, expected) => {
        if (appointments.get(a.id)?.status !== expected) return false;
        appointments.set(a.id, a);
        return true;
      },
      findInRange: async () => [],
      findByStatusFrom: async () => [],
      findByBarberInRange: async () => [],
      findByCustomerFrom: async () => [],
    },
    customers: {
      findByPhone: async (phone) => [PEDRO, ANA].find((c) => c.phone === phone) ?? null,
      findByIds: async (ids) => [PEDRO, ANA].filter((c) => ids.includes(c.id)),
      save: async (c) => c,
    },
    barbers: {
      findByIds: async () => [{ id: "b1", name: "Luis", active: true }],
      findById: async () => null,
      findAllActive: async () => [],
      findAll: async () => [],
      save: async () => {},
    },
    confirmations: {
      save: async (c) => {
        confirmations.push(c);
      },
      findByCode: async (code) => confirmations.filter((c) => c.code === code),
      findOverdue: async (now) => confirmations.filter((c) => c.confirmBy <= now),
      findByAppointment: async () => null,
    },
    processedMessages: {
      wasProcessed: async (id) => processed.has(id),
      markProcessed: async (id) => {
        processed.add(id);
      },
    },
    messaging: { sendText, sendTemplate },
    siteUrl: "https://barberia.example",
    now: () => NOW,
    randomBytes: (n) => new Uint8Array(n),
  };
  return { deps, appointments, confirmations, sendText, sendTemplate };
}

let t: ReturnType<typeof makeDeps>;
let useCase: BookingConfirmationUseCase;

beforeEach(() => {
  t = makeDeps();
  useCase = new BookingConfirmationUseCase(t.deps);
});

describe("pedir confirmación al reservar", () => {
  test("guarda un código y el plazo de 2 h", async () => {
    const issued = await useCase.issue(book("a1", PEDRO), SHOP);
    expect(issued).toEqual({ appointmentId: "a1", code: "AAA222", confirmBy: lima("2026-11-09", "12:00") });
    expect(t.confirmations).toEqual([issued]);
  });

  test("sin WhatsApp configurado no hay plazo: la cita espera al barbero", async () => {
    const off = new BookingConfirmationUseCase({ ...t.deps, messaging: null });
    expect(off.enabled).toBe(false);
    expect(await off.issue(book("a1", PEDRO), SHOP)).toBeNull();
    expect(t.confirmations).toEqual([]);
  });

  test("sin un número al que escribir tampoco", async () => {
    expect(await useCase.issue(book("a1", PEDRO), undefined)).toBeNull();
    expect(t.confirmations).toEqual([]);
  });
});

describe("confirmar por WhatsApp", () => {
  async function pending(id: string, customer: Customer, code = "KRT482") {
    t.appointments.set(id, book(id, customer));
    t.confirmations.push({ appointmentId: id, code, confirmBy: lima("2026-11-09", "12:00") });
  }
  const message = (text: string, from = PEDRO.phone, id = "wamid.1") => ({ id, from, text });
  const replied = () => t.sendText.mock.calls.map(([phone, text]) => ({ phone, text }));

  test("el código de su propia cita la confirma y se lo dice", async () => {
    await pending("a1", PEDRO);
    const outcome = await useCase.handleMessage(message("Confirmo mi cita KRT482"));
    expect(outcome.kind).toBe("confirmed");
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.CONFIRMED);
    expect(replied()).toEqual([{ phone: PEDRO.phone, text: expect.stringMatching(/Listo, Pedro.*16:00.*Luis.*confirmada/) }]);
  });

  test("el mismo código desde otro número no confirma nada", async () => {
    await pending("a1", PEDRO);
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482", ANA.phone))).kind).toBe("not-found");
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.PENDING);
  });

  test("si dos clientes comparten código, cada uno confirma solo la suya", async () => {
    await pending("a1", PEDRO);
    await pending("a2", ANA);
    await useCase.handleMessage(message("Confirmo mi cita KRT482", ANA.phone));
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.PENDING);
    expect(t.appointments.get("a2")?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  test("un aviso repetido por Meta no se atiende dos veces", async () => {
    await pending("a1", PEDRO);
    await useCase.handleMessage(message("Confirmo mi cita KRT482"));
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482"))).kind).toBe("ignored");
    expect(t.sendText).toHaveBeenCalledTimes(1);
  });

  test("si responder falla, el mensaje no queda atendido y el reintento lo resuelve igual", async () => {
    await pending("a1", PEDRO);
    t.sendText.mockRejectedValueOnce(new Error("WhatsApp caído"));
    await expect(useCase.handleMessage(message("Confirmo mi cita KRT482"))).rejects.toThrow();
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482"))).kind).toBe("already-confirmed");
  });

  test("una cita vencida no se reabre: se le ofrece reservar otra hora", async () => {
    await pending("a1", PEDRO);
    t.appointments.set("a1", book("a1", PEDRO).changeStatus(AppointmentStatus.EXPIRED));
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482"))).kind).toBe("expired");
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.EXPIRED);
    expect(replied()[0].text).toContain("https://barberia.example/reservar");
  });

  test("una cancelada tampoco", async () => {
    await pending("a1", PEDRO);
    t.appointments.set("a1", book("a1", PEDRO).changeStatus(AppointmentStatus.CANCELLED));
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482"))).kind).toBe("inactive");
  });

  test("un mensaje sin código recibe las instrucciones", async () => {
    expect((await useCase.handleMessage(message("Hola, ¿tienen hora el sábado?"))).kind).toBe("no-code");
    expect(replied()[0].text).toContain("Confirmo mi cita");
  });

  test("un número que nunca reservó no encuentra nada", async () => {
    await pending("a1", PEDRO);
    expect((await useCase.handleMessage(message("Confirmo mi cita KRT482", "51911111111"))).kind).toBe("not-found");
  });

  test("sin WhatsApp configurado no atiende mensajes", async () => {
    const off = new BookingConfirmationUseCase({ ...t.deps, messaging: null });
    expect((await off.handleMessage(message("Confirmo mi cita KRT482"))).kind).toBe("ignored");
  });
});

describe("vencer las que nadie confirmó", () => {
  const LATE = lima("2026-11-09", "12:30");
  async function pending(id: string, customer: Customer, confirmBy = lima("2026-11-09", "12:00")) {
    t.appointments.set(id, book(id, customer));
    t.confirmations.push({ appointmentId: id, code: "KRT482", confirmBy });
  }
  const at = (now: Date) => new BookingConfirmationUseCase({ ...t.deps, now: () => now });

  test("pasado el plazo, la cita vence, libera el hueco y se avisa al cliente", async () => {
    await pending("a1", PEDRO);
    expect(await at(LATE).expireOverdue()).toEqual({ expired: 1, failed: 0 });
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.EXPIRED);
    expect(t.appointments.get("a1")?.blocksSchedule()).toBe(false);
    expect(t.sendTemplate).toHaveBeenCalledWith(PEDRO.phone, "cita_vencida", [
      "Pedro",
      expect.stringMatching(/16:00/),
      "https://barberia.example/reservar",
    ]);
  });

  test("antes del plazo no vence nada", async () => {
    await pending("a1", PEDRO);
    expect(await at(lima("2026-11-09", "11:59")).expireOverdue()).toEqual({ expired: 0, failed: 0 });
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.PENDING);
  });

  test("una confirmada no vence aunque su plazo haya pasado", async () => {
    await pending("a1", PEDRO);
    t.appointments.set("a1", book("a1", PEDRO).changeStatus(AppointmentStatus.CONFIRMED));
    expect(await at(LATE).expireOverdue()).toEqual({ expired: 0, failed: 0 });
    expect(t.sendTemplate).not.toHaveBeenCalled();
  });

  test("si el cliente confirma justo mientras vence, gana su confirmación", async () => {
    await pending("a1", PEDRO);
    const snapshot = t.appointments.get("a1")!;
    t.appointments.set("a1", snapshot.changeStatus(AppointmentStatus.CONFIRMED));
    const racing = new BookingConfirmationUseCase({
      ...t.deps,
      now: () => LATE,
      appointments: { ...t.deps.appointments, findById: async () => snapshot },
    });
    expect(await racing.expireOverdue()).toEqual({ expired: 0, failed: 0 });
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.CONFIRMED);
    expect(t.sendTemplate).not.toHaveBeenCalled();
  });

  test("si vence justo cuando el cliente escribe, se le dice que venció", async () => {
    await pending("a1", PEDRO);
    const snapshot = t.appointments.get("a1")!;
    t.appointments.set("a1", snapshot.changeStatus(AppointmentStatus.EXPIRED));
    let reads = 0;
    const racing = new BookingConfirmationUseCase({
      ...t.deps,
      appointments: {
        ...t.deps.appointments,
        findById: async (id) => (reads++ === 0 ? snapshot : (t.appointments.get(id) ?? null)),
      },
    });
    expect((await racing.handleMessage({ id: "wamid.7", from: PEDRO.phone, text: "Confirmo mi cita KRT482" })).kind).toBe("expired");
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.EXPIRED);
  });

  test("si el aviso falla, la cita vence igual y se cuenta el fallo", async () => {
    await pending("a1", PEDRO);
    await pending("a2", ANA);
    t.sendTemplate.mockRejectedValueOnce(new Error("plantilla sin aprobar"));
    expect(await at(LATE).expireOverdue()).toEqual({ expired: 2, failed: 1 });
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.EXPIRED);
    expect(t.appointments.get("a2")?.status).toBe(AppointmentStatus.EXPIRED);
  });

  test("sin WhatsApp no vence nada: nadie habría podido confirmar", async () => {
    await pending("a1", PEDRO);
    const off = new BookingConfirmationUseCase({ ...t.deps, messaging: null, now: () => LATE });
    expect(await off.expireOverdue()).toEqual({ expired: 0, failed: 0 });
    expect(t.appointments.get("a1")?.status).toBe(AppointmentStatus.PENDING);
  });
});
