import { describe, expect, it } from "vitest";
import { describeUpcomingDays } from "./upcoming-days";

describe("describeUpcomingDays", () => {
  it("da hoy, mañana y los siguientes con su día de la semana", () => {
    expect(describeUpcomingDays(new Date("2026-11-24T15:00:00Z"), 4)).toBe(
      "hoy mar 24/11 (2026-11-24); mañana mié 25/11 (2026-11-25); jue 26/11 (2026-11-26); vie 27/11 (2026-11-27)",
    );
  });

  it("cruza el mes y devuelve 7 días por defecto", () => {
    const text = describeUpcomingDays(new Date("2026-11-28T15:00:00Z"));
    expect(text.split("; ")).toHaveLength(7);
    expect(text).toContain("mañana dom 29/11 (2026-11-29); lun 30/11 (2026-11-30); mar 01/12 (2026-12-01)");
  });

  it("usa el día de Lima cerca de la medianoche UTC", () => {
    // 03:00 UTC del miércoles 25 aún es martes 24 22:00 en Lima.
    expect(describeUpcomingDays(new Date("2026-11-25T03:00:00Z"), 1)).toBe("hoy mar 24/11 (2026-11-24)");
    // 05:00 UTC ya es miércoles 25 00:00 en Lima.
    expect(describeUpcomingDays(new Date("2026-11-25T05:00:00Z"), 1)).toBe("hoy mié 25/11 (2026-11-25)");
  });
});
