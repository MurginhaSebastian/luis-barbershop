import { afterEach, describe, expect, test, vi } from "vitest";
import type { IMessagingService } from "@/application/ports/messaging";
import { withDevReplies } from "./dev-replies";

function fake(sendText: IMessagingService["sendText"]) {
  const sendTemplate = vi.fn().mockResolvedValue(undefined);
  return { inner: { sendText, sendTemplate } as IMessagingService, sendTemplate };
}

afterEach(() => vi.restoreAllMocks());

describe("withDevReplies", () => {
  test("si sendText falla, se resuelve y la respuesta va a la consola", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { inner } = fake(vi.fn().mockRejectedValue(new Error("token inválido")));
    await expect(withDevReplies(inner).sendText("51900000000", "hola")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[WhatsApp Dev Reply]: hola");
  });

  test("si sendText funciona, no imprime nada", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { inner } = fake(vi.fn().mockResolvedValue(undefined));
    await withDevReplies(inner).sendText("51900000000", "hola");
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test("sendTemplate delega con los mismos argumentos", async () => {
    const { inner, sendTemplate } = fake(vi.fn());
    const replies = ["Confirmo mi cita X", "Cancelar X"];
    await withDevReplies(inner).sendTemplate("51900000000", "recordatorio_cita", ["Ana"], replies);
    expect(sendTemplate).toHaveBeenCalledWith("51900000000", "recordatorio_cita", ["Ana"], replies);
  });
});
