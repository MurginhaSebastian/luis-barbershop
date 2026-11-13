import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IMessagingService } from "@/application/ports/messaging";
import { Appointment } from "@/core/entities/appointment";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import { BookingConfirmationUseCase, type BookingConfirmationDeps } from "./booking-confirmation";

const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);
const NOW = lima("2026-11-09", "10:00");
const SHOP = "51900000000";

const appointment = Appointment.book({
  id: "a1",
  barberId: "b1",
  customerId: "c1",
  customerName: "Pedro",
  start: lima("2026-11-12", "16:00"),
  services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
  products: [],
});

let saved: BookingConfirmation[];
let deps: BookingConfirmationDeps;

beforeEach(() => {
  saved = [];
  deps = {
    confirmations: {
      save: async (c) => {
        saved.push(c);
      },
      findByCode: async () => [],
      findOverdue: async () => [],
      findByAppointment: async () => null,
    },
    messaging: { sendText: vi.fn(), sendTemplate: vi.fn() } satisfies IMessagingService,
    now: () => NOW,
    randomBytes: (n) => new Uint8Array(n),
  };
});

describe("pedir confirmación al reservar", () => {
  test("guarda un código y el plazo de 2 h", async () => {
    const issued = await new BookingConfirmationUseCase(deps).issue(appointment, SHOP);
    expect(issued).toEqual({ appointmentId: "a1", code: "AAA222", confirmBy: lima("2026-11-09", "12:00") });
    expect(saved).toEqual([issued]);
  });

  test("sin WhatsApp configurado no hay plazo: la cita espera al barbero", async () => {
    const off = new BookingConfirmationUseCase({ ...deps, messaging: null });
    expect(off.enabled).toBe(false);
    expect(await off.issue(appointment, SHOP)).toBeNull();
    expect(saved).toEqual([]);
  });

  test("sin un número al que escribir tampoco", async () => {
    expect(await new BookingConfirmationUseCase(deps).issue(appointment, undefined)).toBeNull();
    expect(saved).toEqual([]);
  });
});
