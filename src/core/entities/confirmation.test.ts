import { describe, expect, test } from "vitest";
import { InvalidStatusChangeError } from "../errors/domain-errors";
import { Appointment } from "./appointment";
import { codeInMessage, confirmationCode, confirmationDeadline, wantsToCancel } from "./confirmation";

const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);

describe("confirmationDeadline", () => {
  test("15 min antes de la cita, sin importar cuándo se reservó", () => {
    expect(confirmationDeadline(lima("2026-11-12", "16:00"))).toEqual(lima("2026-11-12", "15:45"));
  });
});

describe("confirmationCode", () => {
  test("tres letras y tres cifras, sin caracteres que se confundan", () => {
    for (let i = 0; i < 200; i++) {
      const code = confirmationCode(crypto.getRandomValues(new Uint8Array(6)));
      expect(code).toMatch(/^[A-HJKMNP-Z]{3}[2-9]{3}$/);
    }
  });

  test("los mismos bytes dan el mismo código", () => {
    const bytes = new Uint8Array([0, 1, 2, 0, 1, 2]);
    expect(confirmationCode(bytes)).toBe("ABC234");
    expect(confirmationCode(bytes)).toBe(confirmationCode(bytes));
  });

  test("sin bytes suficientes no inventa un código", () => {
    expect(() => confirmationCode(new Uint8Array(5))).toThrow();
  });
});

describe("codeInMessage", () => {
  test.each([
    ["Confirmo mi cita KRT482", "KRT482"],
    ["confirmo krt482", "KRT482"],
    ["krt-482 confirmado!", "KRT482"],
    ["KRT 482", "KRT482"],
    ["Hola, el martes confirmo KRT482 gracias", "KRT482"],
  ])("lee el código de %j", (text, code) => {
    expect(codeInMessage(text)).toBe(code);
  });

  test.each([
    ["Hola, ¿tienen hora el sábado?"],
    ["Mi celular es 987654321"],
    ["Confirmo la de las 10:00 del 16/11"],
    ["XKRT4821"],
    ["MARTES"],
  ])("no encuentra código en %j", (text) => {
    expect(codeInMessage(text)).toBeNull();
  });
});

describe("wantsToCancel", () => {
  test.each(["CANCELAR KRT482", "Quiero cancelar mi cita KRT482", "No podré ir, KRT482", "No puedo ir KRT482", "no llego KRT482", "no voy KRT482", "anula KRT482"])("%s cancela", (text) => {
    expect(wantsToCancel(text)).toBe(true);
  });
  test.each(["Confirmo mi cita KRT482", "Sí, voy KRT482", "KRT482", "Notificado KRT482"])("%s no cancela", (text) => {
    expect(wantsToCancel(text)).toBe(false);
  });
});

describe("cita vencida", () => {
  const pending = Appointment.book({
    id: "a1",
    barberId: "b1",
    customerId: "c1",
    customerName: "Cliente",
    start: lima("2026-11-12", "16:00"),
    bookedAt: new Date("2026-11-01T00:00:00Z"), // con días de antelación: nace pendiente
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

  test("una pendiente vence pasando por en riesgo, y deja libre el hueco", () => {
    expect(() => pending.changeStatus("EXPIRED")).toThrow(InvalidStatusChangeError);
    const expired = pending.changeStatus("AT_RISK").changeStatus("EXPIRED");
    expect(expired.status).toBe("EXPIRED");
    expect(expired.blocksSchedule()).toBe(false);
  });

  test("una confirmada ya no vence", () => {
    expect(() => pending.changeStatus("CONFIRMED").changeStatus("EXPIRED")).toThrow(InvalidStatusChangeError);
  });

  test("una vencida no se reabre", () => {
    expect(() => pending.changeStatus("AT_RISK").changeStatus("EXPIRED").changeStatus("CONFIRMED")).toThrow(InvalidStatusChangeError);
  });
});
