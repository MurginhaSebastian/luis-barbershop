import { describe, expect, test } from "vitest";
import { daysBetween, groupByDayPart, shiftDay, shiftPeriod, weeks } from "./days";

describe("daysBetween", () => {
  test("incluye los extremos y cruza el cambio de mes", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  test("un solo día", () => {
    expect(daysBetween("2026-11-02", "2026-11-02")).toEqual(["2026-11-02"]);
  });
});

test("shiftDay cruza meses y años en ambos sentidos", () => {
  expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
});

describe("groupByDayPart", () => {
  // Lima es UTC−5: 16:30Z son las 11:30 y 17:00Z las 12:00.
  test("corta a mediodía en la hora de Lima, no en UTC", () => {
    const morning = "2026-11-02T16:30:00.000Z";
    const noon = "2026-11-02T17:00:00.000Z";
    expect(groupByDayPart([morning, noon])).toEqual([
      { label: "Mañana", slots: [morning] },
      { label: "Tarde", slots: [noon] },
    ]);
  });

  test("omite la parte sin horas", () => {
    expect(groupByDayPart(["2026-11-02T20:00:00.000Z"]).map((p) => p.label)).toEqual(["Tarde"]);
  });
});

describe("shiftPeriod y weeks", () => {
  test("día ±1, semana ±7", () => {
    expect(shiftPeriod("dia", "2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftPeriod("semana", "2026-11-18", -1)).toBe("2026-11-11");
  });
  test("mes: día 1 del mes siguiente o anterior, cruzando de año", () => {
    expect(shiftPeriod("mes", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftPeriod("mes", "2026-12-15", -1)).toBe("2026-11-01");
    expect(shiftPeriod("mes", "2027-01-10", -1)).toBe("2026-12-01");
  });
  test("weeks parte en filas de 7", () => {
    const rows = weeks(daysBetween("2026-11-01", "2026-11-14"));
    expect(rows.map((r) => r.length)).toEqual([7, 7]);
  });
});
