import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidSettingsError } from "@/core/errors/domain-errors";
import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from "./push-actions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  requirePanelSession: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  sendTest: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("./session", () => ({ requirePanelSession: mocks.requirePanelSession }));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({
    managePush: { subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe, sendTest: mocks.sendTest },
  }),
}));

const browserSubscription = {
  endpoint: "https://push.example/1",
  expirationTime: null,
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePanelSession.mockResolvedValue(undefined);
});

describe("avisos push del panel", () => {
  test("sin sesión no activan, desactivan ni envían nada", async () => {
    mocks.requirePanelSession.mockRejectedValue(new Error("REDIRECT /panel/entrar"));
    await expect(subscribePushAction(browserSubscription)).rejects.toThrow("REDIRECT");
    await expect(unsubscribePushAction(browserSubscription.endpoint)).rejects.toThrow("REDIRECT");
    await expect(sendTestPushAction()).rejects.toThrow("REDIRECT");
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect(mocks.sendTest).not.toHaveBeenCalled();
  });

  test("activar guarda lo que da el navegador, sin campos de más", async () => {
    expect(await subscribePushAction(browserSubscription)).toEqual({ ok: "Avisos activados en este dispositivo." });
    expect(mocks.subscribe).toHaveBeenCalledWith({ endpoint: "https://push.example/1", p256dh: "B".repeat(87), auth: "a".repeat(22) });
  });

  test.each([
    ["nada", undefined],
    ["un texto", "https://push.example/1"],
    ["sin claves", { endpoint: "https://push.example/1" }],
    ["un endpoint enorme", { ...browserSubscription, endpoint: `https://${"x".repeat(1000)}` }],
  ])("rechaza %s antes de llegar al caso de uso", async (_, input) => {
    expect(await subscribePushAction(input)).toEqual({ error: "El navegador no dio una suscripción válida." });
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  test("el formato de las claves lo explica el dominio", async () => {
    mocks.subscribe.mockRejectedValue(new InvalidSettingsError("La suscripción no es válida."));
    expect(await subscribePushAction(browserSubscription)).toEqual({ error: "La suscripción no es válida." });
  });

  test("desactivar exige un endpoint de texto", async () => {
    expect(await unsubscribePushAction({ endpoint: "x" })).toEqual({ error: "No se pudo identificar el dispositivo." });
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect(await unsubscribePushAction("https://push.example/1")).toEqual({ ok: "Avisos desactivados en este dispositivo." });
    expect(mocks.unsubscribe).toHaveBeenCalledWith("https://push.example/1");
  });

  test.each([
    [{ sent: 1, removed: 0, failed: 0 }, { ok: "Aviso enviado a 1 dispositivo." }],
    [{ sent: 3, removed: 0, failed: 1 }, { ok: "Aviso enviado a 3 dispositivos." }],
    [{ sent: 0, removed: 1, failed: 0 }, { error: "No llegó a ningún dispositivo. Desactiva y vuelve a activar los avisos." }],
  ])("la prueba cuenta a cuántos llegó", async (report, expected) => {
    mocks.sendTest.mockResolvedValue(report);
    expect(await sendTestPushAction()).toEqual(expected);
  });
});
