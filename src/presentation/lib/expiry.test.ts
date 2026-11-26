import { describe, expect, it } from "vitest";
import { expiryLabel } from "./expiry";

const now = Date.parse("2030-01-01T15:00:00Z");
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

describe("expiryLabel", () => {
  it("en riesgo vence a la hora de la cita", () => {
    expect(expiryLabel({ status: "AT_RISK", start: at(12) }, now)).toBe("Vence en 12 min");
  });
  it("pendiente vence en su plazo de confirmación, no a la hora de la cita", () => {
    expect(expiryLabel({ status: "PENDING", start: at(300), confirmBy: at(285) }, now)).toBe("Vence en 4 h 45 min");
    expect(expiryLabel({ status: "PENDING", start: at(300), confirmBy: at(120) }, now)).toBe("Vence en 2 h");
  });
  it("sin plazo o ya pasado", () => {
    expect(expiryLabel({ status: "PENDING", start: at(300) }, now)).toBeNull();
    expect(expiryLabel({ status: "CONFIRMED", start: at(30), confirmBy: at(10) }, now)).toBeNull();
    expect(expiryLabel({ status: "AT_RISK", start: at(-1) }, now)).toBe("Vence ya");
  });
  it("más de un día: en días", () => {
    expect(expiryLabel({ status: "PENDING", start: at(4400), confirmBy: at(4320) }, now)).toBe("Vence en 3 d");
  });
});
