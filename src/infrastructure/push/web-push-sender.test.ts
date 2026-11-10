import { createECDH, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import webpush from "web-push";
import { describe, expect, test, vi } from "vitest";
import { readVapidKeys, WebPushSender } from "./web-push-sender";

const ece = createRequire(import.meta.url)("http_ece");

/** Un navegador de mentira: sus claves, como las crearía pushManager.subscribe(). */
function browser() {
  const keys = createECDH("prime256v1");
  keys.generateKeys();
  const auth = randomBytes(16);
  return {
    keys,
    auth,
    subscription: {
      endpoint: "https://push.example/abc",
      p256dh: keys.getPublicKey().toString("base64url"),
      auth: auth.toString("base64url"),
    },
  };
}

const vapid = { subject: "mailto:panel@example.com", ...webpush.generateVAPIDKeys() };
const message = { title: "Nueva reserva", body: "Pedro · lun 2 nov, 10:00 · Luis", url: "/panel" };

function sender(status: number) {
  const fetchImpl = vi.fn(async () => new Response(null, { status }));
  return { fetchImpl, sender: new WebPushSender(vapid, fetchImpl as unknown as typeof fetch) };
}

describe("WebPushSender", () => {
  test("cifra el aviso para que solo ese navegador pueda leerlo", async () => {
    const b = browser();
    const { fetchImpl, sender: s } = sender(201);
    expect(await s.send(b.subscription, message)).toBe("sent");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { body: Uint8Array }];
    expect(url).toBe("https://push.example/abc");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: "86400", Urgency: "high" });
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^vapid t=.+, k=/);

    const body = Buffer.from(init.body);
    expect(body.toString()).not.toContain("Pedro");
    const plain = ece.decrypt(body, { version: "aes128gcm", privateKey: b.keys, authSecret: b.auth });
    expect(JSON.parse(plain.toString())).toEqual(message);
  });

  test("otro navegador no puede descifrarlo", async () => {
    const b = browser();
    const other = browser();
    const { fetchImpl, sender: s } = sender(201);
    await s.send(b.subscription, message);
    const body = Buffer.from((fetchImpl.mock.calls[0] as unknown as [string, { body: Uint8Array }])[1].body);
    expect(() => ece.decrypt(body, { version: "aes128gcm", privateKey: other.keys, authSecret: other.auth })).toThrow();
  });

  test.each([404, 410])("con %i la suscripción ya no vale", async (status) => {
    expect(await sender(status).sender.send(browser().subscription, message)).toBe("gone");
  });

  test.each([400, 413, 429, 500])("con %i es un fallo, no se olvida al dispositivo", async (status) => {
    await expect(sender(status).sender.send(browser().subscription, message)).rejects.toThrow(String(status));
  });
});

test("readVapidKeys exige las tres variables", () => {
  expect(readVapidKeys({ VAPID_SUBJECT: "mailto:x@y.z", VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k" })).toEqual({
    subject: "mailto:x@y.z",
    publicKey: "p",
    privateKey: "k",
  });
  expect(readVapidKeys({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "k" })).toBeNull();
});
