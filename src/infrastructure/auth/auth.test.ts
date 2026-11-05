import { afterEach, describe, expect, test, vi } from "vitest";
import { LoginThrottle } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, getPanelConfig, isValidSessionToken, SESSION_HOURS } from "./session";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-11-02T15:00:00Z");
const hoursLater = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("clave", () => {
  test("acepta la clave correcta y rechaza cualquier otra", async () => {
    const stored = await hashPassword("clave-de-prueba");
    expect(await verifyPassword("clave-de-prueba", stored)).toBe(true);
    expect(await verifyPassword("Clave-de-prueba", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  test("dos hashes de la misma clave son distintos y no contienen la clave", async () => {
    const [a, b] = await Promise.all([hashPassword("clave"), hashPassword("clave")]);
    expect(a).not.toBe(b);
    expect(a).not.toContain("clave");
  });

  test("un hash mal formado nunca da acceso", async () => {
    for (const stored of ["", "sinseparador", "abc:", ":abc", "abc:1234"]) {
      expect(await verifyPassword("clave", stored)).toBe(false);
    }
  });
});

describe("sesión", () => {
  test("vale hasta que caduca", () => {
    const token = createSessionToken(SECRET, NOW);
    expect(isValidSessionToken(token, SECRET, hoursLater(SESSION_HOURS - 1))).toBe(true);
    expect(isValidSessionToken(token, SECRET, hoursLater(SESSION_HOURS + 1))).toBe(false);
  });

  test("no se puede alargar ni falsificar", () => {
    const token = createSessionToken(SECRET, NOW);
    const [, signature] = token.split(".");
    const later = String(hoursLater(1000).getTime());
    expect(isValidSessionToken(`${later}.${signature}`, SECRET, NOW)).toBe(false);
    expect(isValidSessionToken(token, "otro-secreto".repeat(4), NOW)).toBe(false);
  });

  test.each([undefined, "", "basura", ".", "123.", ".abc"])("rechaza %j", (token) => {
    expect(isValidSessionToken(token, SECRET, NOW)).toBe(false);
  });
});

describe("configuración del panel", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("sin clave o con un secreto corto, el panel queda cerrado", () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", "");
    vi.stubEnv("PANEL_SESSION_SECRET", SECRET);
    expect(getPanelConfig()).toBeNull();

    vi.stubEnv("PANEL_PASSWORD_HASH", "sal:hash");
    vi.stubEnv("PANEL_SESSION_SECRET", "corto");
    expect(getPanelConfig()).toBeNull();

    vi.stubEnv("PANEL_SESSION_SECRET", SECRET);
    expect(getPanelConfig()).toEqual({ passwordHash: "sal:hash", sessionSecret: SECRET });
  });
});

describe("freno de intentos", () => {
  const minutesLater = (m: number) => new Date(NOW.getTime() + m * 60_000);

  test("bloquea tras 5 fallos y libera pasado el plazo", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure("ip", NOW);
    expect(throttle.isBlocked("ip", minutesLater(14))).toBe(true);
    expect(throttle.isBlocked("ip", minutesLater(16))).toBe(false);
  });

  test("cada origen cuenta aparte y entrar bien borra los fallos", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 5; i++) throttle.recordFailure("ip", NOW);
    expect(throttle.isBlocked("otra", NOW)).toBe(false);
    throttle.reset("ip");
    expect(throttle.isBlocked("ip", NOW)).toBe(false);
  });

  test("no acumula memoria con orígenes viejos", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 100; i++) throttle.recordFailure(`ip-${i}`, NOW);
    throttle.recordFailure("nueva", minutesLater(20));
    expect(throttle.size).toBe(1);
  });
});
