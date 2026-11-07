import { describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "./entities/appointment";
import { normalizePhone } from "./entities/customer";
import { TimeSlot } from "./entities/time-slot";
import { InvalidDateError, InvalidTimeSlotError } from "./errors/domain-errors";
import { availableSlots, bookingWindow, shopDateOf, shopDayRange, shopWeekday } from "./scheduling/availability";
import { MAX_DAYS_AHEAD, MIN_ADVANCE_MINUTES } from "./scheduling/booking-policy";

const at = (iso: string) => new Date(iso);
const starts = (slots: TimeSlot[]) => slots.map((s) => s.start.toISOString().slice(11, 16));
// Lunes 2026-11-02: la apertura de las 10:00 en Lima son las 15:00 UTC.
const DATE = "2026-11-02";
const morning = [{ openMinute: 600, closeMinute: 720 }];
const slots = (overrides: Partial<Parameters<typeof availableSlots>[0]>) =>
  availableSlots({ date: DATE, hours: morning, busy: [], durationMinutes: 30, now: at("2026-11-01T12:00:00Z"), ...overrides });

describe("ventana de reserva, justo en el límite", () => {
  test("la hora exacta de la antelación mínima se puede reservar; un minuto después, no", () => {
    expect(MIN_ADVANCE_MINUTES).toBe(120);
    expect(starts(slots({ now: at("2026-11-02T13:00:00Z") }))[0]).toBe("15:00");
    expect(starts(slots({ now: at("2026-11-02T13:01:00Z") }))[0]).toBe("15:30");
  });

  test("el último instante del plazo máximo se puede reservar; lo siguiente, no", () => {
    expect(MAX_DAYS_AHEAD).toBe(14);
    const now = at("2026-11-01T15:00:00Z");
    expect(starts(availableSlots({ date: "2026-11-15", hours: morning, busy: [], durationMinutes: 30, now }))).toEqual(["15:00"]);
  });

  test("la ventana se calcula desde el instante actual", () => {
    const { notBefore, notAfter } = bookingWindow(at("2026-11-01T12:00:00Z"));
    expect(notBefore.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(notAfter.toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
});

describe("huecos del día", () => {
  test("un servicio que llena el tramo entero cabe; uno más largo, no", () => {
    expect(starts(slots({ durationMinutes: 120 }))).toEqual(["15:00"]);
    expect(slots({ durationMinutes: 121 })).toEqual([]);
  });

  test("un día sin horario no ofrece nada", () => {
    expect(slots({ hours: [] })).toEqual([]);
  });

  test("salen ordenados aunque los tramos lleguen desordenados", () => {
    const hours = [
      { openMinute: 900, closeMinute: 930 },
      { openMinute: 600, closeMinute: 630 },
    ];
    expect(starts(slots({ hours }))).toEqual(["15:00", "20:00"]);
  });

  test("un bloqueo de todo el día deja el día sin horas", () => {
    expect(slots({ busy: [shopDayRange(DATE)] })).toEqual([]);
  });

  test("el servicio largo no puede empezar si termina pisando una cita", () => {
    const busy = [TimeSlot.create(at("2026-11-02T16:00:00Z"), at("2026-11-02T16:30:00Z"))];
    expect(starts(slots({ busy, durationMinutes: 60 }))).toEqual(["15:00"]);
  });
});

describe("calendario de Lima", () => {
  test("el cambio de día ocurre a medianoche de Lima, no de UTC", () => {
    expect(shopDateOf(at("2026-11-03T04:59:59Z"))).toBe("2026-11-02");
    expect(shopDateOf(at("2026-11-03T05:00:00Z"))).toBe("2026-11-03");
  });

  test("un día dura 24 horas y cruza bien el cambio de mes y de año", () => {
    const range = shopDayRange("2026-12-31");
    expect(range.durationMinutes).toBe(1440);
    expect(range.end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  test("acepta el 29 de febrero solo en año bisiesto", () => {
    expect(shopWeekday("2028-02-29")).toBe(2);
    expect(() => shopWeekday("2026-02-29")).toThrow(InvalidDateError);
  });

  test.each(["", "2026-13-01", "2026-1-1", "02/11/2026", "2026-11-02T00:00:00Z", "hoy"])("rechaza la fecha %j", (date) => {
    expect(() => shopDayRange(date)).toThrow(InvalidDateError);
  });
});

describe("TimeSlot", () => {
  test("rechaza fechas inválidas y duraciones sin tiempo", () => {
    expect(() => TimeSlot.create(new Date("nada"), at("2026-11-02T15:00:00Z"))).toThrow(InvalidTimeSlotError);
    expect(() => TimeSlot.ofMinutes(at("2026-11-02T15:00:00Z"), 0)).toThrow(InvalidTimeSlotError);
  });

  test("detecta un hueco idéntico y uno contenido en otro", () => {
    const big = TimeSlot.ofMinutes(at("2026-11-02T15:00:00Z"), 60);
    expect(big.overlaps(big)).toBe(true);
    expect(big.overlaps(TimeSlot.ofMinutes(at("2026-11-02T15:15:00Z"), 15))).toBe(true);
    expect(TimeSlot.ofMinutes(at("2026-11-02T15:15:00Z"), 15).overlaps(big)).toBe(true);
  });
});

describe("normalizePhone", () => {
  test.each([
    ["(999) 888-777", "51999888777"],
    ["51999888777", "51999888777"],
    ["+51999888777", "51999888777"],
    ["014567890", "014567890"],
    ["", ""],
  ])("%j queda como %j", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe("Appointment", () => {
  const base = {
    id: "a1",
    barberId: "b1",
    customerId: "c1",
    customerName: "Pedro",
    start: at("2026-11-02T15:00:00Z"),
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 45, priceCents: 3550 }],
    products: [],
  };

  test("sin productos, el total es solo el de los servicios y conserva los céntimos", () => {
    expect(Appointment.book(base).totalCents).toBe(3550);
  });

  test("cambiar de estado conserva quién reservó", () => {
    const confirmed = Appointment.book(base).changeStatus(AppointmentStatus.CONFIRMED);
    expect(confirmed.customerName).toBe("Pedro");
    expect(confirmed.blocksSchedule()).toBe(true);
  });

  test("una cita atendida sigue ocupando su hueco en la agenda", () => {
    const done = Appointment.restore({ ...Appointment.book(base), status: AppointmentStatus.COMPLETED });
    expect(done.blocksSchedule()).toBe(true);
  });
});
