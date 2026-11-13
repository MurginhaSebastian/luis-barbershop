import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidStatusChangeError } from "@/core/errors/domain-errors";
import { hashPassword } from "@/infrastructure/auth/password";
import { changeStatusAction, loginAction, logoutAction } from "./actions";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  refresh: vi.fn(),
  requirePanelSession: vi.fn(),
  startPanelSession: vi.fn(),
  endPanelSession: vi.fn(),
  forwardedFor: { value: "203.0.113.1" },
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": mocks.forwardedFor.value }) }));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({ changeAppointmentStatus: { execute: mocks.execute } }),
}));
vi.mock("./session", () => ({
  requirePanelSession: mocks.requirePanelSession,
  startPanelSession: mocks.startPanelSession,
  endPanelSession: mocks.endPanelSession,
}));

const ID = "40000000-0000-4000-8000-000000000001";
const SECRET = "s".repeat(32);
let hash: string;

const passwordForm = (password: string) => {
  const f = new FormData();
  f.append("password", password);
  return f;
};

beforeAll(async () => {
  hash = await hashPassword("clave-correcta");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePanelSession.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue(undefined);
  vi.stubEnv("PANEL_PASSWORD_HASH", hash);
  vi.stubEnv("PANEL_SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("changeStatusAction", () => {
  test("sin sesión no toca ninguna cita", async () => {
    mocks.requirePanelSession.mockRejectedValue(new Error("REDIRECT /panel/entrar"));
    await expect(changeStatusAction(ID, "CANCELLED")).rejects.toThrow("REDIRECT");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("con sesión cambia el estado y refresca la agenda", async () => {
    expect(await changeStatusAction(ID, "CONFIRMED")).toEqual({});
    expect(mocks.execute).toHaveBeenCalledWith({ id: ID, status: "CONFIRMED" });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("rechaza identificadores y estados manipulados", async () => {
    expect((await changeStatusAction("1 OR 1=1", "CONFIRMED")).error).toBeDefined();
    expect((await changeStatusAction(ID, "BORRADO" as "CONFIRMED")).error).toBeDefined();
    // Vencer lo decide el plazo de confirmación, no el panel.
    expect((await changeStatusAction(ID, "EXPIRED")).error).toBeDefined();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("muestra los errores de negocio y no refresca", async () => {
    mocks.execute.mockRejectedValue(new InvalidStatusChangeError());
    expect((await changeStatusAction(ID, "CONFIRMED")).error).toContain("ya no admite");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("un fallo inesperado no filtra detalles internos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.execute.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5433"));
    const { error } = await changeStatusAction(ID, "CONFIRMED");
    expect(error).toBe("No se pudo guardar el cambio. Inténtalo de nuevo.");
  });
});

describe("loginAction", () => {
  // Cada prueba usa su origen: el freno de intentos guarda estado entre llamadas.
  let origin = 10;
  beforeEach(() => {
    mocks.forwardedFor.value = `203.0.113.${origin++}`;
  });

  test("sin configurar no deja entrar ni con una clave cualquiera", async () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", "");
    expect(await loginAction({}, passwordForm("clave-correcta"))).toEqual({ error: "El panel aún no está configurado." });
    expect(mocks.startPanelSession).not.toHaveBeenCalled();
  });

  test("la clave correcta inicia sesión y entra al panel", async () => {
    await expect(loginAction({}, passwordForm("clave-correcta"))).rejects.toThrow("REDIRECT /panel");
    expect(mocks.startPanelSession).toHaveBeenCalledWith(SECRET);
  });

  test("una clave equivocada, vacía, enorme o que no es texto no entra", async () => {
    const notText = new FormData();
    notText.append("password", new Blob(["clave-correcta"]));
    for (const form of [passwordForm("mala"), passwordForm(""), passwordForm("x".repeat(201)), notText, new FormData()]) {
      mocks.forwardedFor.value = `203.0.113.${origin++}`;
      expect(await loginAction({}, form)).toEqual({ error: "La clave no es correcta." });
    }
    expect(mocks.startPanelSession).not.toHaveBeenCalled();
  });

  test("el sexto intento se bloquea sin comprobar la clave", async () => {
    for (let i = 0; i < 5; i++) await loginAction({}, passwordForm("mala"));
    expect(await loginAction({}, passwordForm("clave-correcta"))).toEqual({ error: "Demasiados intentos. Espera 15 minutos." });
    expect(mocks.startPanelSession).not.toHaveBeenCalled();
  });

  test("entrar bien borra los fallos de ese origen", async () => {
    for (let i = 0; i < 4; i++) await loginAction({}, passwordForm("mala"));
    await expect(loginAction({}, passwordForm("clave-correcta"))).rejects.toThrow("REDIRECT");
    for (let i = 0; i < 4; i++) await loginAction({}, passwordForm("mala"));
    expect(await loginAction({}, passwordForm("mala"))).toEqual({ error: "La clave no es correcta." });
  });
});

test("cerrar sesión borra la cookie y vuelve a la entrada", async () => {
  await expect(logoutAction()).rejects.toThrow("REDIRECT /panel/entrar");
  expect(mocks.endPanelSession).toHaveBeenCalled();
});
