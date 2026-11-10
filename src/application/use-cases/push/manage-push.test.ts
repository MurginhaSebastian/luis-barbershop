import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PushMessage } from "@/application/ports/push";
import { Appointment } from "@/core/entities/appointment";
import type { PushSubscription } from "@/core/entities/push";
import { InvalidSettingsError } from "@/core/errors/domain-errors";
import { ManagePushUseCase } from "./manage-push";

const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const sub = (n: number): PushSubscription => ({ endpoint: `https://push.example/${n}`, p256dh: P256DH, auth: AUTH });

const appointment = Appointment.book({
  id: "a1",
  barberId: "b1",
  customerId: "c1",
  customerName: "Pedro",
  start: new Date("2026-11-02T15:00:00Z"),
  services: [
    { serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 },
    { serviceId: "s2", name: "Barba", durationMinutes: 30, priceCents: 2000 },
  ],
  products: [],
});

function makeDeps() {
  const subscriptions: PushSubscription[] = [];
  const sent: { subscription: PushSubscription; message: PushMessage }[] = [];
  const send = vi.fn(async (subscription: PushSubscription, message: PushMessage): Promise<"sent" | "gone"> => {
    sent.push({ subscription, message });
    return "sent";
  });
  return {
    subscriptions,
    sent,
    send,
    deps: {
      pushSubscriptions: {
        findAll: async () => [...subscriptions],
        save: async (s: PushSubscription) => {
          const i = subscriptions.findIndex((x) => x.endpoint === s.endpoint);
          if (i >= 0) subscriptions[i] = s;
          else subscriptions.push(s);
        },
        remove: async (endpoint: string) => {
          const i = subscriptions.findIndex((x) => x.endpoint === endpoint);
          if (i >= 0) subscriptions.splice(i, 1);
        },
      },
      barbers: {
        findById: async () => null,
        findByIds: async () => [{ id: "b1", name: "Luis", active: true }],
        findAllActive: async () => [],
        findAll: async () => [],
        save: async () => {},
      },
      pushSender: { send },
    },
  };
}

let t: ReturnType<typeof makeDeps>;
let push: ManagePushUseCase;

beforeEach(() => {
  t = makeDeps();
  push = new ManagePushUseCase(t.deps);
});

describe("suscripciones", () => {
  test("guarda una vez por dispositivo aunque se active dos veces", async () => {
    await push.subscribe(sub(1));
    await push.subscribe({ ...sub(1), auth: "b".repeat(22) });
    expect(t.subscriptions).toEqual([{ ...sub(1), auth: "b".repeat(22) }]);
  });

  test.each([
    ["un endpoint http", { endpoint: "http://push.example/1" }],
    ["un endpoint que no es URL", { endpoint: "javascript:alert(1)" }],
    ["una clave con caracteres raros", { p256dh: `${"B".repeat(86)}'` }],
    ["una clave corta", { auth: "abc" }],
  ])("rechaza %s", async (_, change) => {
    await expect(push.subscribe({ ...sub(1), ...change })).rejects.toThrow(InvalidSettingsError);
    expect(t.subscriptions).toEqual([]);
  });

  test("desactivar borra solo ese dispositivo", async () => {
    await push.subscribe(sub(1));
    await push.subscribe(sub(2));
    await push.unsubscribe(sub(1).endpoint);
    expect(t.subscriptions).toEqual([sub(2)]);
  });
});

describe("aviso de reserva nueva", () => {
  test("llega a todos los dispositivos con cliente, hora de Lima, barbero y servicios, pero sin el celular", async () => {
    await push.subscribe(sub(1));
    await push.subscribe(sub(2));
    expect(await push.notifyNewBooking(appointment)).toEqual({ sent: 2, removed: 0, failed: 0 });

    const { message } = t.sent[0];
    expect(message.title).toBe("Nueva reserva");
    expect(message.body).toContain("Pedro");
    expect(message.body).toMatch(/10:00/);
    expect(message.body).toContain("Luis");
    expect(message.body).toContain("Corte, Barba");
    expect(message.url).toBe("/panel");
    expect(JSON.stringify(message)).not.toMatch(/51\d{9}|9\d{8}/);
  });

  test("olvida los dispositivos que ya no aceptan avisos", async () => {
    await push.subscribe(sub(1));
    await push.subscribe(sub(2));
    t.send.mockImplementationOnce(async () => "gone");
    expect(await push.notifyNewBooking(appointment)).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(t.subscriptions).toHaveLength(1);
  });

  test("un dispositivo que falla no impide avisar al resto ni se borra", async () => {
    await push.subscribe(sub(1));
    await push.subscribe(sub(2));
    t.send.mockRejectedValueOnce(new Error("timeout"));
    expect(await push.notifyNewBooking(appointment)).toEqual({ sent: 1, removed: 0, failed: 1 });
    expect(t.subscriptions).toHaveLength(2);
  });

  test("sin claves VAPID no intenta enviar", async () => {
    const off = new ManagePushUseCase({ ...t.deps, pushSender: null });
    await off.subscribe(sub(1));
    expect(off.enabled).toBe(false);
    expect(await off.notifyNewBooking(appointment)).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(t.send).not.toHaveBeenCalled();
  });

  test("la prueba manual usa el mismo camino", async () => {
    await push.subscribe(sub(1));
    expect(await push.sendTest()).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(t.sent[0].message.title).toBe("Avisos activados");
  });
});
