import { expect, test } from "vitest";
import { GetChatsUseCase } from "./get-chats";

const NOW = new Date("2026-11-16T15:30:00-05:00");
const at = (min: number) => new Date(NOW.getTime() - min * 60_000);

test("agrupa por celular, ordena por el más reciente, pone nombre y vista previa del último", async () => {
  let asked: Date | undefined;
  const useCase = new GetChatsUseCase({
    conversations: {
      since: async (since: Date) => {
        asked = since;
        return [
          { phone: "51900000001", role: "user", content: "hola", at: at(50) },
          { phone: "51900000002", role: "user", content: "quiero fade", at: at(30) },
          { phone: "51900000001", role: "assistant", content: "¿Qué día?", at: at(20) },
          { phone: "51900000002", role: "assistant", content: "¿A qué hora?", at: at(10) },
        ] as const;
      },
    } as never,
    customers: { findByPhone: async (p: string) => (p === "51900000001" ? { id: "c1", name: "Pedro", phone: p } : null) } as never,
    now: () => NOW,
  });
  const threads = await useCase.execute();
  expect(asked).toEqual(new Date(NOW.getTime() - 24 * 3600_000));
  expect(threads.map((t) => [t.phone, t.name, t.preview])).toEqual([
    ["51900000002", null, "¿A qué hora?"],
    ["51900000001", "Pedro", "¿Qué día?"],
  ]);
  expect(threads[1].messages.map((m) => m.content)).toEqual(["hola", "¿Qué día?"]);
  expect(threads[1].lastAt).toBe(at(20).toISOString());
});

test("sin conversaciones, lista vacía", async () => {
  const useCase = new GetChatsUseCase({ conversations: { since: async () => [] } as never, customers: {} as never, now: () => NOW });
  expect(await useCase.execute()).toEqual([]);
});
