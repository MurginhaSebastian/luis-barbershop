import { describe, expect, test } from "vitest";
import { formatDayParts, formatLongDate, formatMinuteOfDay, formatPrice, formatTime } from "./format";
import { daysLabel } from "./hours";

describe("formatPrice", () => {
  test.each([
    [3000, "30.00"],
    [0, "0.00"],
    [5, "0.05"],
    [123456, "1,234.56"],
  ])("%i céntimos se muestran en soles", (cents, amount) => {
    const text = formatPrice(cents);
    expect(text).toContain("S/");
    expect(text).toContain(amount);
  });
});

describe("hora y fecha de Lima", () => {
  test("una hora tarde en Lima no salta al día siguiente aunque en UTC ya sea mañana", () => {
    const iso = "2026-11-03T02:00:00.000Z";
    expect(formatTime(iso)).toBe("21:00");
    expect(formatLongDate(iso)).toBe("lunes, 2 de noviembre");
  });

  test("formatMinuteOfDay rellena con ceros", () => {
    expect(formatMinuteOfDay(0)).toBe("00:00");
    expect(formatMinuteOfDay(615)).toBe("10:15");
    expect(formatMinuteOfDay(1200)).toBe("20:00");
  });

  test("formatDayParts da día de la semana, número y mes sin puntos", () => {
    expect(formatDayParts("2026-11-09")).toEqual({ weekday: "lun", day: "9", month: "nov" });
    expect(formatDayParts("2026-12-31").day).toBe("31");
  });
});

describe("daysLabel", () => {
  test.each([
    [{ first: 0, last: 0 }, "Domingo"],
    [{ first: 1, last: 2 }, "Lunes y martes"],
    [{ first: 1, last: 6 }, "Lunes a sábado"],
    [{ first: 6, last: 0 }, "Sábado y domingo"],
    [{ first: 1, last: 0 }, "Lunes a domingo"],
  ])("%j se lee %j", (group, label) => {
    expect(daysLabel({ ...group, hours: [] })).toBe(label);
  });
});
