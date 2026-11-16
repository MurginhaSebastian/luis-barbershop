import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Appointment } from "@/core/entities/appointment";
import { BookingWindowError, SlotUnavailableError, TooManyActiveAppointmentsError } from "@/core/errors/domain-errors";
import { createAppointmentAction } from "./actions";

const { execute, notifyNewBooking, notifyReleased, issue, confirmation, afterResponse } = vi.hoisted(() => ({
  execute: vi.fn(),
  notifyNewBooking: vi.fn(),
  notifyReleased: vi.fn(),
  issue: vi.fn(),
  confirmation: { number: null as string | null },
  afterResponse: [] as (() => Promise<void>)[],
}));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({
    createAppointment: { execute },
    managePush: { notifyNewBooking },
    bookingConfirmation: {
      issue,
      notifyReleased,
      get confirmationNumber() {
        return confirmation.number;
      },
    },
  }),
}));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => afterResponse.push(task) }));

const BARBER = "10000000-0000-4000-8000-000000000001";
const SERVICE = "20000000-0000-4000-8000-000000000001";
const START = "2026-11-02T15:00:00.000Z";

function form(overrides: Record<string, string> = {}) {
  const f = new FormData();
  const fields = { barberId: BARBER, serviceIds: SERVICE, name: "Cliente Prueba", phone: "900000001", start: START, ...overrides };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const idle = { status: "idle" } as const;

// Con llaves: Vitest ejecutaría como limpieza la función que devuelve mockReset.
beforeEach(() => {
  execute.mockReset();
  notifyNewBooking.mockReset();
  notifyReleased.mockReset().mockResolvedValue({ sent: 0, failed: 0 });
  issue.mockReset().mockResolvedValue(null);
  confirmation.number = null;
  afterResponse.length = 0;
});
afterEach(() => vi.restoreAllMocks());

const booked = () =>
  Appointment.book({
    id: "a1",
    barberId: BARBER,
    customerId: "c1",
    customerName: "Cliente Prueba",
    start: new Date(START),
    bookedAt: new Date("2026-11-01T00:00:00Z"), // con días de antelación: nace pendiente
    services: [{ serviceId: SERVICE, name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

describe("createAppointmentAction", () => {
  test("una reserva válida devuelve lo que muestra la confirmación", async () => {
    execute.mockResolvedValue({ appointment: booked(), displaced: [] });

    expect(await createAppointmentAction(idle, form())).toEqual({
      status: "ok",
      start: START,
      totalCents: 3000,
      barberId: BARBER,
      confirmed: false,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ barberId: BARBER, customer: { name: "Cliente Prueba", phone: "900000001" } }),
    );
  });

  test("datos inválidos no llegan a la base y marcan el campo", async () => {
    const state = await createAppointmentAction(idle, form({ phone: "123" }));
    expect(execute).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error", fieldErrors: { phone: expect.stringContaining("9 dígitos") } });
  });

  test("el precio nunca se acepta desde el formulario", async () => {
    execute.mockRejectedValue(new SlotUnavailableError());
    await createAppointmentAction(idle, form({ totalCents: "1", priceCents: "1" }));
    const input = execute.mock.calls[0][0];
    expect(input).not.toHaveProperty("totalCents");
    expect(input).not.toHaveProperty("priceCents");
  });

  test("una hora ocupada lo indica para ofrecer elegir otra", async () => {
    execute.mockRejectedValue(new SlotUnavailableError());
    expect(await createAppointmentAction(idle, form())).toMatchObject({ status: "error", slotTaken: true });
  });

  test("los errores de negocio se muestran tal cual, sin ofrecer otra hora", async () => {
    execute.mockRejectedValue(new TooManyActiveAppointmentsError(2));
    expect(await createAppointmentAction(idle, form())).toEqual({
      status: "error",
      message: expect.stringContaining("2 citas"),
      slotTaken: false,
    });
    execute.mockRejectedValue(new BookingWindowError("Fuera de plazo."));
    expect(await createAppointmentAction(idle, form())).toMatchObject({ message: "Fuera de plazo." });
  });

  test("un fallo inesperado no filtra detalles internos al cliente", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValue(new Error("password authentication failed for user barbershop"));

    const state = await createAppointmentAction(idle, form());
    expect(JSON.stringify(state)).not.toContain("password");
    expect(state).toMatchObject({ status: "error", message: expect.stringContaining("Inténtalo de nuevo") });
    expect(log).toHaveBeenCalled();
  });

  describe("aviso al panel", () => {
    test("se envía después de responder, con la cita reservada", async () => {
      const appointment = booked();
      execute.mockResolvedValue({ appointment, displaced: [] });
      notifyNewBooking.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });

      await createAppointmentAction(idle, form());
      expect(notifyNewBooking).not.toHaveBeenCalled();
      expect(afterResponse).toHaveLength(1);
      await afterResponse[0]();
      expect(notifyNewBooking).toHaveBeenCalledWith(appointment);
    });

    test("si falla, se registra y la reserva sigue hecha", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      execute.mockResolvedValue({ appointment: booked(), displaced: [] });
      notifyNewBooking.mockRejectedValue(new Error("push caído"));

      expect(await createAppointmentAction(idle, form())).toMatchObject({ status: "ok" });
      await expect(afterResponse[0]()).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith("aviso de reserva", expect.any(Error));
    });

    test("los dispositivos que no lo recibieron quedan en el registro", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      execute.mockResolvedValue({ appointment: booked(), displaced: [] });
      notifyNewBooking.mockResolvedValue({ sent: 1, removed: 0, failed: 1 });
      await createAppointmentAction(idle, form());
      await afterResponse[0]();
      expect(log).toHaveBeenCalledWith("aviso de reserva", { sent: 1, removed: 0, failed: 1 });
    });

    test("avisa por WhatsApp a quien perdió su hora en riesgo, después de responder", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const displaced = [booked().changeStatus("AT_RISK").changeStatus("EXPIRED")];
      execute.mockResolvedValue({ appointment: booked(), displaced });
      notifyNewBooking.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
      notifyReleased.mockResolvedValue({ sent: 0, failed: 1 });

      await createAppointmentAction(idle, form());
      expect(notifyReleased).not.toHaveBeenCalled();
      await afterResponse[0]();
      expect(notifyReleased).toHaveBeenCalledWith(displaced);
      expect(log).toHaveBeenCalledWith("aviso a clientes desplazados", { sent: 0, failed: 1 });
    });

    test("una reserva rechazada no avisa", async () => {
      execute.mockRejectedValue(new SlotUnavailableError());
      await createAppointmentAction(idle, form());
      expect(afterResponse).toEqual([]);
    });
  });

  describe("confirmación por WhatsApp", () => {
    test("con WhatsApp devuelve el código, el plazo y a qué número escribir", async () => {
      const appointment = booked();
      execute.mockResolvedValue({ appointment, displaced: [] });
      confirmation.number = "51911111111";
      issue.mockResolvedValue({ appointmentId: "a1", code: "KRT482", confirmBy: new Date("2026-11-01T17:00:00Z") });

      expect(await createAppointmentAction(idle, form())).toMatchObject({
        status: "ok",
        confirmation: { code: "KRT482", confirmBy: "2026-11-01T17:00:00.000Z", whatsapp: "51911111111" },
      });
      expect(issue).toHaveBeenCalledWith(appointment);
    });

    test("sin WhatsApp la reserva no lleva confirmación", async () => {
      execute.mockResolvedValue({ appointment: booked(), displaced: [] });
      const state = await createAppointmentAction(idle, form());
      expect(state).toMatchObject({ status: "ok" });
      expect(state).not.toHaveProperty("confirmation", expect.anything());
    });

    test("si falla, la reserva sigue hecha y la confirma el barbero", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      execute.mockResolvedValue({ appointment: booked(), displaced: [] });
      confirmation.number = "51911111111";
      issue.mockRejectedValue(new Error("base caída"));
      const state = await createAppointmentAction(idle, form());
      expect(state).toMatchObject({ status: "ok" });
      expect(state).not.toHaveProperty("confirmation", expect.anything());
      expect(log).toHaveBeenCalledWith("confirmación por WhatsApp", expect.any(Error));
    });
  });
});
