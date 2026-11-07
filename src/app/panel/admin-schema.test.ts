import { describe, expect, test } from "vitest";
import { parseBarberForm, parseBlockForm, parseHoursForm, parseProductForm, parseServiceForm } from "./admin-schema";

const ID = "20000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("precio en soles", () => {
  test.each([
    ["30", 3000],
    ["30.5", 3050],
    ["30.50", 3050],
    ["30,50", 3050],
    ["0.07", 7],
    ["19.99", 1999],
    ["  45  ", 4500],
    ["0", 0],
  ])("%j son %i céntimos, sin errores de redondeo", (price, cents) => {
    expect(parseProductForm(form({ name: "Cera", price })).data?.priceCents).toBe(cents);
  });

  test.each(["", "abc", "-5", "30.555", "1e3", "S/ 30", "999999"])("rechaza %j", (price) => {
    expect(parseProductForm(form({ name: "Cera", price })).success).toBe(false);
  });
});

describe("servicio", () => {
  test("un alta llega sin id y activa si se marca", () => {
    const r = parseServiceForm(form({ id: "", name: " Corte ", durationMinutes: "30", price: "30", active: "on" }));
    expect(r.data).toEqual({ id: undefined, name: "Corte", durationMinutes: 30, priceCents: 3000, active: true });
  });

  test("sin marcar queda oculto y una edición conserva el id", () => {
    const r = parseServiceForm(form({ id: ID, name: "Corte", durationMinutes: "30", price: "30" }));
    expect(r.data).toMatchObject({ id: ID, active: false });
  });

  test("rechaza un id manipulado y una duración que no es número", () => {
    expect(parseServiceForm(form({ id: "1 OR 1=1", name: "Corte", durationMinutes: "30", price: "30" })).success).toBe(false);
    expect(parseServiceForm(form({ name: "Corte", durationMinutes: "media hora", price: "30" })).success).toBe(false);
  });
});

test("barbero", () => {
  expect(parseBarberForm(form({ name: "Luis", active: "on" })).data).toMatchObject({ name: "Luis", active: true });
  expect(parseBarberForm(form({ name: "L" })).success).toBe(false);
});

describe("horario", () => {
  test("convierte las horas a minutos y admite jornada partida", () => {
    const r = parseHoursForm(form({ weekday: "1", open1: "10:00", close1: "14:00", open2: "15:30", close2: "20:00" }));
    expect(r.data).toEqual({
      weekday: 1,
      hours: [
        { openMinute: 600, closeMinute: 840 },
        { openMinute: 930, closeMinute: 1200 },
      ],
    });
  });

  test("sin tramos el día queda cerrado", () => {
    expect(parseHoursForm(form({ weekday: "0", open1: "", close1: "", open2: "", close2: "" })).data?.hours).toEqual([]);
  });

  test("un tramo a medias o una hora imposible se rechaza", () => {
    expect(parseHoursForm(form({ weekday: "1", open1: "10:00", close1: "" })).success).toBe(false);
    expect(parseHoursForm(form({ weekday: "1", open1: "25:00", close1: "26:00" })).success).toBe(false);
    expect(parseHoursForm(form({ weekday: "7", open1: "10:00", close1: "14:00" })).success).toBe(false);
  });
});

describe("bloqueo", () => {
  test("sin horas cubre los días completos en hora de Lima", () => {
    const r = parseBlockForm(form({ barberId: "", from: "2026-11-02", to: "2026-11-03", fromTime: "", toTime: "", reason: "" }));
    expect(r.data).toEqual({
      barberId: null,
      start: new Date("2026-11-02T05:00:00.000Z"),
      end: new Date("2026-11-04T05:00:00.000Z"),
      reason: null,
    });
  });

  test("con horas cubre solo ese tramo", () => {
    const r = parseBlockForm(form({ barberId: ID, from: "2026-11-02", to: "2026-11-02", fromTime: "10:00", toTime: "12:00", reason: " Médico " }));
    expect(r.data).toEqual({
      barberId: ID,
      start: new Date("2026-11-02T15:00:00.000Z"),
      end: new Date("2026-11-02T17:00:00.000Z"),
      reason: "Médico",
    });
  });

  test("rechaza fechas imposibles, ids manipulados y motivos enormes", () => {
    const base = { barberId: "", from: "2026-11-02", to: "2026-11-02", fromTime: "", toTime: "", reason: "" };
    expect(parseBlockForm(form({ ...base, to: "2026-02-30" })).success).toBe(false);
    expect(parseBlockForm(form({ ...base, from: "" })).success).toBe(false);
    expect(parseBlockForm(form({ ...base, barberId: "<script>" })).success).toBe(false);
    expect(parseBlockForm(form({ ...base, reason: "x".repeat(121) })).success).toBe(false);
  });
});
