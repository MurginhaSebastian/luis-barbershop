import { describe, expect, test } from "vitest";
import { blockHeight, dayTimeline as timeline, freeTime, gapHeight, gridHours, isOperational, limaMinuteOfDay, placeDay, toGrid } from "./timeline";

const at = (hhmm: string) => `2026-11-12T${hhmm}:00-05:00`;
const item = (id: string, from: string, to: string) => ({ id, start: at(from), end: at(to) });
// Abierto de 9:00 a 20:00, sin bloqueos, salvo que la prueba diga otra cosa.
const ALL_DAY = freeTime([{ start: at("09:00"), end: at("20:00") }], []);
const dayTimeline = <T extends { start: string; end: string }>(items: T[], free = ALL_DAY) => timeline(items, free);
const gapsOf = (rows: ReturnType<typeof timeline>) =>
  rows.flatMap((r) => (r.kind === "gap" ? [`${r.start.slice(11, 16)}-${r.end.slice(11, 16)}`] : []));

describe("dayTimeline", () => {
  test("una en riesgo y la que tomó su hora comparten franja, apiladas", () => {
    const rows = dayTimeline([item("cazador", "10:00", "10:30"), item("riesgo", "10:00", "10:45")]);
    expect(rows).toEqual([{ kind: "slot", start: at("10:00"), end: at("10:45"), items: [expect.objectContaining({ id: "cazador" }), expect.objectContaining({ id: "riesgo" })] }]);
  });

  test("citas seguidas van en franjas propias; entre ellas, el hueco si caben 15 min", () => {
    const rows = dayTimeline([item("c", "12:00", "12:30"), item("a", "10:00", "10:45"), item("b", "10:45", "11:15")]);
    expect(rows.map((r) => (r.kind === "slot" ? r.items.map((i) => i.id).join("+") : `libre ${r.minutes}`))).toEqual(["a", "b", "libre 45", "c"]);
  });

  test("un hueco de menos de 15 min no se muestra", () => {
    expect(dayTimeline([item("a", "10:00", "10:50"), item("b", "11:00", "11:30")]).map((r) => r.kind)).toEqual(["slot", "slot"]);
  });

  test("una franja se alarga con la cita que termina más tarde", () => {
    const [slot] = dayTimeline([item("a", "10:00", "11:00"), item("b", "10:30", "10:45"), item("c", "10:50", "11:30")]);
    expect(slot).toMatchObject({ kind: "slot", end: at("11:30") });
  });
});

describe("huecos libres: solo dentro del horario y fuera de los bloqueos", () => {
  const items = [item("a", "10:00", "11:00"), item("b", "16:00", "16:30")];

  test("el cierre del mediodía parte el hueco en dos (en UTC: Lima + 5 h)", () => {
    const open = [
      { start: at("09:00"), end: at("14:00") },
      { start: at("15:00"), end: at("20:00") },
    ];
    expect(gapsOf(dayTimeline(items, freeTime(open, [])))).toEqual(["16:00-19:00", "20:00-21:00"]);
  });

  test("un bloqueo nunca sale como libre", () => {
    const free = freeTime([{ start: at("09:00"), end: at("20:00") }], [{ start: at("12:00"), end: at("15:50") }]);
    expect(gapsOf(dayTimeline(items, free))).toEqual(["16:00-17:00"]); // 11:00-12:00 en Lima
  });

  test("lo que queda de menos de 15 min no se muestra", () => {
    const free = freeTime([{ start: at("09:00"), end: at("20:00") }], [{ start: at("11:10"), end: at("16:00") }]);
    expect(gapsOf(dayTimeline(items, free))).toEqual([]);
  });
});

test("alto proporcional a la duración, con mínimo legible", () => {
  expect(blockHeight(at("10:00"), at("10:45"))).toBe(135);
  expect(blockHeight(at("10:00"), at("10:15"))).toBe(64);
  expect(gapHeight(30)).toBe(90);
  expect(gapHeight(300)).toBe(180);
});

test("canceladas y vencidas no van en la línea de tiempo", () => {
  expect(["PENDING", "CONFIRMED", "AT_RISK", "COMPLETED", "NO_SHOW"].every((s) => isOperational(s as never))).toBe(true);
  expect(isOperational("CANCELLED")).toBe(false);
  expect(isOperational("EXPIRED")).toBe(false);
});

describe("maquetación del calendario", () => {
  test("limaMinuteOfDay", () => {
    expect(limaMinuteOfDay("2026-11-18T22:00:00.000Z")).toBe(1020);
    expect(limaMinuteOfDay("2026-11-18T03:00:00.000Z")).toBe(1320);
    expect(limaMinuteOfDay("2026-11-18T05:00:00.000Z")).toBe(0);
  });
  test("gridHours", () => {
    const open = [{ start: at("10:00"), end: at("14:00") }, { start: at("15:00"), end: at("20:00") }];
    expect(gridHours(open)).toEqual({ startMinute: 600, endMinute: 1200 });
    expect(gridHours([...open, { start: at("20:15"), end: at("20:45") }])).toEqual({ startMinute: 600, endMinute: 1260 });
    expect(gridHours([])).toEqual({ startMinute: 540, endMinute: 1200 });
  });
  test("toGrid", () => {
    expect(toGrid(at("17:00"), at("17:45"), { startMinute: 600 })).toEqual({ top: 420, height: 45 });
    expect(toGrid(at("17:00"), at("17:15"), { startMinute: 600 }).height).toBe(24);
  });
  test("placeDay: cruzadas, encadenadas y separadas", () => {
    const g = { startMinute: 600 };
    const lanes = (list: ReturnType<typeof item>[]) => placeDay(list, g).map((p) => [p.lane, p.lanes]);
    expect(lanes([item("a", "10:00", "10:45"), item("b", "10:00", "10:30")])).toEqual([[0, 2], [1, 2]]);
    expect(lanes([item("a", "10:00", "11:00"), item("b", "10:30", "11:30"), item("c", "11:00", "12:00")])).toEqual([[0, 2], [1, 2], [0, 2]]);
    expect(lanes([item("a", "10:00", "10:30"), item("b", "11:00", "11:30")])).toEqual([[0, 1], [0, 1]]);
  });
});
