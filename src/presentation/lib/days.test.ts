import { describe, expect, test } from "vitest";
import { daysBetween, groupByDayPart } from "./days";

describe("daysBetween", () => {
  test("incluye los extremos y cruza el cambio de mes", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  test("un solo día", () => {
    expect(daysBetween("2026-11-02", "2026-11-02")).toEqual(["2026-11-02"]);
  });
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
