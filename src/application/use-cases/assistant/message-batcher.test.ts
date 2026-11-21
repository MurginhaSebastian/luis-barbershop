import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageBatcher } from "./message-batcher";

const msg = (id: string, text: string, from = "51900000001") => ({ id, from, text });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function make(flush = vi.fn(async () => {})) {
  return { flush, batcher: new MessageBatcher({ delayMs: 3500, flush }) };
}

describe("MessageBatcher", () => {
  it("3 mensajes seguidos salen como un solo lote con el id del último", async () => {
    const { batcher, flush } = make();
    const done = [batcher.add(msg("1", "hola")), batcher.add(msg("2", "quiero fade")), batcher.add(msg("3", "mañana 5 pm"))];
    await vi.advanceTimersByTimeAsync(3499);
    expect(flush).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith({ id: "3", from: "51900000001", text: "hola\nquiero fade\nmañana 5 pm" });
    await expect(Promise.all(done)).resolves.toBeDefined();
  });

  it("cada mensaje reinicia la espera", async () => {
    const { batcher, flush } = make();
    void batcher.add(msg("1", "a"));
    await vi.advanceTimersByTimeAsync(3000);
    void batcher.add(msg("2", "b"));
    await vi.advanceTimersByTimeAsync(3000);
    expect(flush).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("otro celular va aparte", async () => {
    const { batcher, flush } = make();
    void batcher.add(msg("1", "uno"));
    void batcher.add(msg("2", "dos", "51900000002"));
    await vi.advanceTimersByTimeAsync(3500);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("vacía al llegar a 5 mensajes", async () => {
    const { batcher, flush } = make();
    for (let i = 1; i <= 5; i++) void batcher.add(msg(String(i), `m${i}`));
    await vi.advanceTimersByTimeAsync(0);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(expect.objectContaining({ id: "5", text: "m1\nm2\nm3\nm4\nm5" }));
  });

  it("vacía a los 10 s del primero aunque sigan llegando", async () => {
    const { batcher, flush } = make();
    for (let i = 0; i < 4; i++) {
      void batcher.add(msg(String(i), `m${i}`));
      await vi.advanceTimersByTimeAsync(i < 3 ? 3000 : 900);
    }
    expect(flush).not.toHaveBeenCalled(); // t = 9,9 s
    await vi.advanceTimersByTimeAsync(100);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("conserva el final cuando no cabe", async () => {
    const { batcher, flush } = make();
    void batcher.add(msg("1", "a".repeat(300)));
    void batcher.add(msg("2", "quiero un fade"));
    await vi.advanceTimersByTimeAsync(3500);
    const sent = (flush.mock.calls[0] as unknown as [{ text: string }])[0].text;
    expect(sent).toHaveLength(250);
    expect(sent.endsWith("quiero un fade")).toBe(true);
  });

  it("si el flush falla, las promesas del lote se rechazan", async () => {
    const { batcher } = make(vi.fn(async () => { throw new Error("caído"); }));
    const p = batcher.add(msg("1", "a"));
    const check = expect(p).rejects.toThrow("caído");
    await vi.advanceTimersByTimeAsync(3500);
    await check;
  });
});
