import { beforeEach, expect, test, vi } from "vitest";
import type { MessageOutcome } from "@/application/ports/assistant";
import { HandleIncomingMessageUseCase } from "./handle-incoming-message";

const claimed = new Set<string>();
const processedMessages = {
  claim: async (id: string) => !claimed.has(id) && !!claimed.add(id),
  release: async (id: string) => void claimed.delete(id),
};
const handleMessage = vi.fn<() => Promise<MessageOutcome>>();
const incoming = new HandleIncomingMessageUseCase({ processedMessages, assistant: { handleMessage } });
const message = { id: "wamid.1", from: "51900000001", text: "Quiero un corte mañana" };

beforeEach(() => {
  claimed.clear();
  handleMessage.mockReset().mockResolvedValue({ kind: "no-code" });
});

test("un aviso repetido por Meta no se atiende dos veces, aunque llegue mientras el primero sigue en curso", async () => {
  let finish = () => {};
  handleMessage.mockImplementationOnce(() => new Promise((done) => (finish = () => done({ kind: "no-code" }))));
  const first = incoming.execute(message);
  await vi.waitFor(() => expect(handleMessage).toHaveBeenCalledTimes(1));
  expect(await incoming.execute(message)).toEqual({ kind: "ignored" });
  finish();
  expect(await first).toEqual({ kind: "no-code" });
  expect(handleMessage).toHaveBeenCalledTimes(1);
});

test("si el asistente falla, el mensaje se libera y el reintento de Meta lo atiende", async () => {
  handleMessage.mockRejectedValueOnce(new Error("WhatsApp caído"));
  await expect(incoming.execute(message)).rejects.toThrow("WhatsApp caído");
  expect(await incoming.execute(message)).toEqual({ kind: "no-code" });
  expect(handleMessage).toHaveBeenCalledTimes(2);
});

test("un mensaje ya reclamado se atiende sin volver a reclamarlo, y si falla se libera", async () => {
  expect(await incoming.claim(message.id)).toBe(true);
  expect(await incoming.claim(message.id)).toBe(false);
  handleMessage.mockRejectedValueOnce(new Error("caído"));
  await expect(incoming.handleClaimed(message)).rejects.toThrow("caído");
  expect(await incoming.claim(message.id)).toBe(true);
});
