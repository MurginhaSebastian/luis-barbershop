import { describe, expect, test } from "vitest";
import { groupWeekdays } from "./hours";

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
