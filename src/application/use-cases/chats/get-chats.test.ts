import { describe, expect, test } from "vitest";
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
    appointments: { findByCustomerFrom: async () => [] } as never,
    barbers: {} as never,
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
  const useCase = new GetChatsUseCase({ conversations: { since: async () => [] } as never, customers: {} as never, appointments: {} as never, barbers: {} as never, now: () => NOW });
  expect(await useCase.execute()).toEqual([]);
});

describe("nextAppointment", () => {
  const appt = (status: string, startMin: number, barberId = "b1") => ({
    status,
    barberId,
    slot: { start: new Date(NOW.getTime() + startMin * 60_000) },
    services: [{ name: "Barba" }, { name: "Corte" }],
  });
  const build = (phone: string, found: boolean, appointments: unknown[]) =>
    new GetChatsUseCase({
      conversations: { since: async () => [{ phone, role: "user", content: "hola", at: at(5) }] } as never,
      customers: { findByPhone: async () => (found ? { id: "c1", name: "Pedro" } : null) } as never,
      appointments: { findByCustomerFrom: async () => appointments } as never,
      barbers: { findById: async () => ({ name: "Mateo" }) } as never,
      now: () => NOW,
    });

  test("toma la más cercana sin atender, con servicios y barbero", async () => {
    const [t] = await build("51900000001", true, [appt("CONFIRMED", 300), appt("CANCELLED", 10), appt("PENDING", 120)]).execute();
    expect(t.nextAppointment).toEqual({
      status: "PENDING",
      startsAt: new Date(NOW.getTime() + 120 * 60_000).toISOString(),
      services: ["Barba", "Corte"],
      barberName: "Mateo",
    });
  });

  test("sin cliente o solo con citas canceladas, null", async () => {
    expect((await build("51900000001", false, []).execute())[0].nextAppointment).toBeNull();
    expect((await build("51900000001", true, [appt("CANCELLED", 60), appt("COMPLETED", 90)]).execute())[0].nextAppointment).toBeNull();
  });
});
