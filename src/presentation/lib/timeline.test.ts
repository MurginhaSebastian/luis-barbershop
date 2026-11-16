import { describe, expect, test } from "vitest";
import { blockHeight, dayTimeline, gapHeight, isOperational } from "./timeline";

const at = (hhmm: string) => `2026-11-12T${hhmm}:00-05:00`;
const item = (id: string, from: string, to: string) => ({ id, start: at(from), end: at(to) });

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
