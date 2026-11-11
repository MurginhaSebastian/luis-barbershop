import { describe, expect, test } from "vitest";
import { describeOpening, groupWeekdays } from "./hours";

const split = [
  { openMinute: 600, closeMinute: 840 },
  { openMinute: 900, closeMinute: 1200 },
];
// Índice 0 = domingo, como lo devuelve el catálogo.
const week = (byDay: Record<number, typeof split>) => [0, 1, 2, 3, 4, 5, 6].map((d) => byDay[d] ?? []);

describe("groupWeekdays", () => {
  test("lunes a sábado iguales y domingo cerrado", () => {
    expect(groupWeekdays(week({ 1: split, 2: split, 3: split, 4: split, 5: split, 6: split }))).toEqual([
      { first: 1, last: 6, hours: split },
      { first: 0, last: 0, hours: [] },
    ]);
  });

  test("solo agrupa días seguidos con los mismos tramos", () => {
    const short = [{ openMinute: 600, closeMinute: 840 }];
    expect(groupWeekdays(week({ 1: split, 2: split, 3: short, 4: split, 6: short })).map((g) => [g.first, g.last])).toEqual([
      [1, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [0, 0],
    ]);
  });

  test("todo cerrado es un solo grupo", () => {
    expect(groupWeekdays(week({}))).toEqual([{ first: 1, last: 0, hours: [] }]);
  });
});

describe("describeOpening", () => {
  const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);
  const now = lima("2026-11-09", "11:30"); // lunes

  test.each([
    [{ open: true as const, until: lima("2026-11-09", "14:00") }, "Abierto ahora, hasta las 14:00"],
    [{ open: false as const, opensAt: lima("2026-11-09", "15:00") }, "Cerrado ahora. Abre hoy a las 15:00"],
    [{ open: false as const, opensAt: lima("2026-11-10", "10:00") }, "Cerrado. Abre mañana a las 10:00"],
    [{ open: false as const, opensAt: lima("2026-11-12", "10:00") }, "Cerrado. Abre el jueves a las 10:00"],
    [{ open: false as const, opensAt: lima("2026-11-20", "10:00") }, "Cerrado. Abre el viernes, 20 de noviembre"],
  ])("%o", (status, text) => {
    expect(describeOpening(status, now)).toBe(text);
  });

  test("de noche, 'mañana' es el día siguiente en Lima, no en UTC", () => {
    // 22:00 en Lima ya es el día siguiente en UTC.
    expect(describeOpening({ open: false, opensAt: lima("2026-11-10", "10:00") }, lima("2026-11-09", "22:00"))).toBe(
      "Cerrado. Abre mañana a las 10:00",
    );
  });

  test("sin horario no dice nada", () => {
    expect(describeOpening(null, now)).toBeNull();
  });
});
