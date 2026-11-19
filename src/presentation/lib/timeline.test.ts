import { describe, expect, test } from "vitest";
import { freeGaps, gridHours, isOperational, limaMinuteOfDay, placeDay, toGrid } from "./timeline";

const at = (hhmm: string) => `2026-11-12T${hhmm}:00-05:00`;
const item = (id: string, from: string, to: string) => ({ id, start: at(from), end: at(to) });
test("canceladas y vencidas no van en la grilla", () => {
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

describe("freeGaps", () => {
  const iv = (from: string, to: string) => ({ start: at(from), end: at(to) });
  const open = [iv("10:00", "14:00"), iv("15:00", "20:00")];
  const gaps = (busy: ReturnType<typeof iv>[], min?: number) =>
    freeGaps(open, busy, min).map((g) => `${limaMinuteOfDay(g.start)}-${limaMinuteOfDay(g.end)}`);

  test("sin nada ocupado, cada tramo abierto es un hueco", () => {
    expect(gaps([])).toEqual(["600-840", "900-1200"]);
  });
  test("hueco al inicio, en medio y al final", () => {
    expect(gaps([iv("10:30", "11:00"), iv("13:00", "14:00"), iv("15:00", "19:00")])).toEqual(["600-630", "660-780", "1140-1200"]);
  });
  test("citas solapadas y fuera del horario no rompen nada", () => {
    expect(gaps([iv("10:00", "12:00"), iv("11:00", "13:00"), iv("08:00", "09:00"), iv("14:00", "15:00")])).toEqual(["780-840", "900-1200"]);
    expect(gaps([iv("09:00", "21:00")])).toEqual([]);
  });
  test("los huecos menores al mínimo se descartan", () => {
    expect(gaps([iv("10:20", "13:50")])).toEqual(["900-1200"]);
    expect(gaps([iv("10:20", "13:50")], 10)).toEqual(["600-620", "830-840", "900-1200"]);
  });
});
