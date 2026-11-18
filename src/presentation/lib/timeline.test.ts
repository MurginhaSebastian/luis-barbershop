import { describe, expect, test } from "vitest";
import { gridHours, isOperational, limaMinuteOfDay, placeDay, toGrid } from "./timeline";

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
