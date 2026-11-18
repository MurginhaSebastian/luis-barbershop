import { describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "./entities/appointment";
import { normalizePhone } from "./entities/customer";
import { TimeSlot } from "./entities/time-slot";
import {
  InvalidAppointmentError,
  InvalidDateError,
  InvalidStatusChangeError,
  InvalidTimeSlotError,
} from "./errors/domain-errors";
import { addDays, availableSlots, shopDateOf, shopDayRange, shopWeekday } from "./scheduling/availability";

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
    customerName: "Cliente Prueba",
    start: at("2026-11-02T15:00:00Z"),
    bookedAt: new Date("2026-11-01T00:00:00Z"), // con días de antelación: nace pendiente
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

  test("solo pendiente y confirmada ocupan agenda: en riesgo, atendida, cancelada, no vino y vencida la dejan libre", () => {
    const a = Appointment.book(base);
    const { PENDING, CONFIRMED, ...free } = AppointmentStatus;
    for (const status of [PENDING, CONFIRMED]) expect(Appointment.restore({ ...a, status }).blocksSchedule()).toBe(true);
    for (const status of Object.values(free)) expect(Appointment.restore({ ...a, status }).blocksSchedule()).toBe(false);
  });

  test("una cita en riesgo puede confirmarse, atenderse o vencer; una confirmada no pasa a riesgo", () => {
    const atRisk = Appointment.book(base).changeStatus(AppointmentStatus.AT_RISK);
    for (const status of ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"] as const) {
      expect(atRisk.changeStatus(status).status).toBe(status);
    }
    expect(() => Appointment.book(base).changeStatus("CONFIRMED").changeStatus("AT_RISK")).toThrow(InvalidStatusChangeError);
    expect(() => atRisk.changeStatus("EXPIRED").changeStatus("AT_RISK")).toThrow(InvalidStatusChangeError);
  });

  test("con menos de 2 h de antelación nace confirmada; con 2 h o más, pendiente", () => {
    const start = base.start.getTime();
    const bookedMinutesBefore = (m: number) => Appointment.book({ ...base, bookedAt: new Date(start - m * 60_000) }).status;
    expect(bookedMinutesBefore(119)).toBe(AppointmentStatus.CONFIRMED);
    expect(bookedMinutesBefore(10)).toBe(AppointmentStatus.CONFIRMED);
    expect(bookedMinutesBefore(120)).toBe(AppointmentStatus.PENDING);
    expect(bookedMinutesBefore(3 * 24 * 60)).toBe(AppointmentStatus.PENDING);
  });

  test("el cliente cancela con 35 min o más; con menos, solo si aún no había confirmado", () => {
    const minutesBefore = (m: number) => new Date(base.start.getTime() - m * 60_000);
    const pending = Appointment.book(base);
    const confirmed = pending.changeStatus(AppointmentStatus.CONFIRMED);
    const atRisk = pending.changeStatus(AppointmentStatus.AT_RISK);
    expect(confirmed.customerCanCancel(minutesBefore(35))).toBe(true);
    expect(confirmed.customerCanCancel(minutesBefore(34))).toBe(false);
    expect(pending.customerCanCancel(minutesBefore(20))).toBe(true); // responde "no podré ir" al aviso de -35 min
    expect(atRisk.customerCanCancel(minutesBefore(10))).toBe(true);
    expect(pending.customerCanCancel(minutesBefore(0))).toBe(false); // ya es la hora
    expect(pending.changeStatus(AppointmentStatus.CANCELLED).customerCanCancel(minutesBefore(60))).toBe(false);
  });

  test("sigue el recorrido de una cita", () => {
    const { CONFIRMED, COMPLETED } = AppointmentStatus;
    const done = Appointment.book(base).changeStatus(CONFIRMED).changeStatus(COMPLETED);
    expect(done.status).toBe(COMPLETED);
  });

  test("cambiar de estado no altera el resto de la cita", () => {
    const a = Appointment.book(base);
    const confirmed = a.changeStatus(AppointmentStatus.CONFIRMED);
    expect(a.status).toBe(AppointmentStatus.PENDING);
    expect(confirmed.slot).toBe(a.slot);
    expect(confirmed.totalCents).toBe(a.totalCents);
  });

  test.each([
    ["PENDING", "COMPLETED"],
    ["CANCELLED", "CONFIRMED"],
    ["NO_SHOW", "CONFIRMED"],
    ["COMPLETED", "CANCELLED"],
    ["CONFIRMED", "CONFIRMED"],
  ] as const)("no permite pasar de %s a %s", (from, to) => {
    const a = Appointment.restore({ ...Appointment.book(base), status: from });
    expect(() => a.changeStatus(to)).toThrow(InvalidStatusChangeError);
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

  test("addDays cruza mes y año, admite negativos y valida", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-02", 0)).toBe("2026-11-02");
    expect(() => addDays("2026-02-30", 1)).toThrow(InvalidDateError);
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

  test("también se puede empezar justo cuando termina una cita, para no dejar huecos muertos", () => {
    // Cita de 10:00 a 10:45 (corte + barba): la siguiente puede empezar a las 10:45, no solo a las 11:00.
    const busy = [slot("2026-11-02T15:00:00Z", "2026-11-02T15:45:00Z")];
    const slots = availableSlots({ date: "2026-11-02", hours: [hours[0]], busy, durationMinutes: 45, now });
    expect(starts(slots)).toEqual(["15:45", "16:00", "16:30", "17:00", "17:30", "18:00"]);
  });

  test("el final de algo ocupado no cuenta si cae fuera del tramo o no deja sitio antes del cierre", () => {
    const busy = [slot("2026-11-02T18:00:00Z", "2026-11-02T18:40:00Z"), slot("2026-11-02T19:00:00Z", "2026-11-02T20:10:00Z")];
    const slots = availableSlots({ date: "2026-11-02", hours, busy, durationMinutes: 30, now });
    expect(starts(slots)).toContain("21:30");
    expect(starts(slots)).not.toContain("18:40"); // 18:40 + 30 min pasa del cierre de las 19:00
    expect(starts(slots)).toContain("20:10");
    expect(starts(slots)).not.toContain("20:00"); // lo tapa el bloqueo hasta las 20:10
  });

  test("respeta la antelación mínima y el máximo de días", () => {
    const soon = at("2026-11-02T15:26:00Z"); // 10:26 en Lima: las 10:30 aún se puede (4 min no)
    expect(starts(availableSlots({ date: "2026-11-02", hours: [hours[0]], busy: [], durationMinutes: 30, now: soon }))[0]).toBe("16:00");
    const early = at("2026-11-02T15:20:00Z"); // 10:20: las 10:30 sí, faltan 10 min
    expect(starts(availableSlots({ date: "2026-11-02", hours: [hours[0]], busy: [], durationMinutes: 30, now: early }))[0]).toBe("15:30");
    expect(availableSlots({ date: "2026-12-03", hours, busy: [], durationMinutes: 30, now })).toEqual([]);
  });
});
