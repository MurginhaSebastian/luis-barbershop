import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Appointment } from "@/core/entities/appointment";
import { BookingWindowError, SlotUnavailableError, TooManyActiveAppointmentsError } from "@/core/errors/domain-errors";
import { createAppointmentAction } from "./actions";

const execute = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/container", () => ({ getUseCases: () => ({ createAppointment: { execute } }) }));

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
});
afterEach(() => vi.restoreAllMocks());

describe("createAppointmentAction", () => {
  test("una reserva válida devuelve lo que muestra la confirmación", async () => {
    execute.mockResolvedValue(
      Appointment.book({
        id: "a1",
        barberId: BARBER,
        customerId: "c1",
        customerName: "Cliente Prueba",
        start: new Date(START),
        services: [{ serviceId: SERVICE, name: "Corte", durationMinutes: 30, priceCents: 3000 }],
        products: [],
      }),
    );

    expect(await createAppointmentAction(idle, form())).toEqual({ status: "ok", start: START, totalCents: 3000, barberId: BARBER });
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
});
