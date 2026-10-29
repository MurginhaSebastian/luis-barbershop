import { describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "./entities/appointment";
import { normalizePhone } from "./entities/customer";
import { TimeSlot } from "./entities/time-slot";
import { InvalidAppointmentError, InvalidDateError, InvalidTimeSlotError } from "./errors/domain-errors";
import { availableSlots, shopDateOf, shopDayRange, shopWeekday } from "./scheduling/availability";

const at = (iso: string) => new Date(iso);
const slot = (from: string, to: string) => TimeSlot.create(at(from), at(to));
const starts = (slots: TimeSlot[]) => slots.map((s) => s.start.toISOString().slice(11, 16));

describe("TimeSlot", () => {
  test("rechaza intervalos vacíos o invertidos", () => {
    expect(() => slot("2026-11-02T15:00:00Z", "2026-11-02T15:00:00Z")).toThrow(InvalidTimeSlotError);
    expect(() => slot("2026-11-02T16:00:00Z", "2026-11-02T15:00:00Z")).toThrow(InvalidTimeSlotError);
  });

  test("dos huecos que solo se tocan no se solapan", () => {
    const a = slot("2026-11-02T15:00:00Z", "2026-11-02T15:30:00Z");
    expect(a.overlaps(slot("2026-11-02T15:30:00Z", "2026-11-02T16:00:00Z"))).toBe(false);
    expect(a.overlaps(slot("2026-11-02T15:29:00Z", "2026-11-02T16:00:00Z"))).toBe(true);
  });
});

describe("Appointment", () => {
  const base = {
    id: "a1",
    barberId: "b1",
    customerId: "c1",
    start: at("2026-11-02T15:00:00Z"),
    services: [
      { serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 },
      { serviceId: "s2", name: "Barba", durationMinutes: 15, priceCents: 1500 },
    ],
    products: [{ productId: "p1", name: "Cera", quantity: 2, unitPriceCents: 2500 }],
  };

  test("nace PENDING, dura la suma de servicios y totaliza servicios + productos", () => {
    const a = Appointment.book(base);
    expect(a.status).toBe(AppointmentStatus.PENDING);
    expect(a.slot.durationMinutes).toBe(45);
    expect(a.totalCents).toBe(3000 + 1500 + 2 * 2500);
    expect(a.blocksSchedule()).toBe(true);
  });

  test("cancelada o no-show deja libre la agenda", () => {
    const a = Appointment.book(base);
    for (const status of [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]) {
      expect(Appointment.restore({ ...a, status }).blocksSchedule()).toBe(false);
    }
  });

  test("exige al menos un servicio y cantidades enteras positivas", () => {
    expect(() => Appointment.book({ ...base, services: [] })).toThrow(InvalidAppointmentError);
    expect(() =>
      Appointment.book({ ...base, products: [{ ...base.products[0], quantity: 0 }] }),
    ).toThrow(InvalidAppointmentError);
  });
});

describe("normalizePhone", () => {
  test("misma clave para el mismo móvil escrito de varias formas", () => {
    expect(normalizePhone("999 888 777")).toBe("51999888777");
    expect(normalizePhone("+51 999-888-777")).toBe("51999888777");
  });
});

describe("calendario de la barbería (Lima, UTC−5)", () => {
  test("día, día de la semana y rango local", () => {
    expect(shopWeekday("2026-11-02")).toBe(1); // lunes
    expect(shopDateOf(at("2026-11-03T04:59:00Z"))).toBe("2026-11-02");
    expect(shopDayRange("2026-11-02").start.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(() => shopWeekday("2026-02-30")).toThrow(InvalidDateError);
  });
});

describe("availableSlots", () => {
  const now = at("2026-11-01T12:00:00Z");
  // Lunes 10:00–14:00 y 15:00–17:00 en Lima = 15:00–19:00 y 20:00–22:00 UTC.
  const hours = [
    { openMinute: 600, closeMinute: 840 },
    { openMinute: 900, closeMinute: 1020 },
  ];

  test("cada 30 min desde la apertura y solo si el servicio cabe antes del cierre", () => {
    const slots = availableSlots({ date: "2026-11-02", hours, busy: [], durationMinutes: 60, now });
    expect(starts(slots)).toEqual(["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "20:00", "20:30", "21:00"]);
  });

  test("descarta los que pisan algo ocupado, pero no los que solo lo tocan", () => {
    const busy = [slot("2026-11-02T16:00:00Z", "2026-11-02T17:00:00Z")];
    const slots = availableSlots({ date: "2026-11-02", hours: [hours[0]], busy, durationMinutes: 60, now });
    expect(starts(slots)).toEqual(["15:00", "17:00", "17:30", "18:00"]);
  });

  test("respeta la antelación mínima y el máximo de días", () => {
    const soon = at("2026-11-02T15:10:00Z"); // 10:10 en Lima: 10:00 ya pasó y 10:30/11:00 no llegan a 1 h
    expect(starts(availableSlots({ date: "2026-11-02", hours: [hours[0]], busy: [], durationMinutes: 30, now: soon }))[0]).toBe("16:30");
    expect(availableSlots({ date: "2026-12-03", hours, busy: [], durationMinutes: 30, now })).toEqual([]);
  });
});
