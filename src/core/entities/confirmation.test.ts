import { describe, expect, test } from "vitest";
import { InvalidStatusChangeError } from "../errors/domain-errors";
import { Appointment } from "./appointment";
import { codeInMessage, confirmationCode, confirmationDeadline } from "./confirmation";

const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);

describe("confirmationDeadline", () => {
  test("una cita lejana: 2 h para confirmar desde que se reserva", () => {
    expect(confirmationDeadline(lima("2026-11-09", "10:00"), lima("2026-11-12", "16:00"))).toEqual(lima("2026-11-09", "12:00"));
  });

  test("una cita pronto: como tarde 1 h antes de la cita", () => {
    expect(confirmationDeadline(lima("2026-11-09", "10:00"), lima("2026-11-09", "12:30"))).toEqual(lima("2026-11-09", "11:30"));
  });

  test("en el empate da igual cuál se tome", () => {
    expect(confirmationDeadline(lima("2026-11-09", "10:00"), lima("2026-11-09", "13:00"))).toEqual(lima("2026-11-09", "12:00"));
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

describe("cita vencida", () => {
  const pending = Appointment.book({
    id: "a1",
    barberId: "b1",
    customerId: "c1",
    customerName: "Cliente",
    start: lima("2026-11-12", "16:00"),
    services: [{ serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 }],
    products: [],
  });

  test("una pendiente vence y deja libre el hueco", () => {
    const expired = pending.changeStatus("EXPIRED");
    expect(expired.status).toBe("EXPIRED");
    expect(expired.blocksSchedule()).toBe(false);
  });

  test("una confirmada ya no vence", () => {
    expect(() => pending.changeStatus("CONFIRMED").changeStatus("EXPIRED")).toThrow(InvalidStatusChangeError);
  });

  test("una vencida no se reabre", () => {
    expect(() => pending.changeStatus("EXPIRED").changeStatus("CONFIRMED")).toThrow(InvalidStatusChangeError);
  });
});
