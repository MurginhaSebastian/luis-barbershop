import { createHmac } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { isSignedByMeta, readWhatsAppConfig, WhatsAppCloudSender } from "./whatsapp-cloud";

function sender(status = 200, body = "{}") {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, { status }));
  return { fetchImpl, sender: new WhatsAppCloudSender({ token: "tok", phoneNumberId: "123" }, fetchImpl) };
}
const sentBody = (fetchImpl: ReturnType<typeof sender>["fetchImpl"]) => JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));

describe("WhatsAppCloudSender", () => {
  test("texto: al número con +, con el token del negocio", async () => {
    const { fetchImpl, sender: s } = sender();
    await s.sendText("51900000001", "Tu cita quedó confirmada.");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v27.0/123/messages");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(sentBody(fetchImpl)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+51900000001",
      type: "text",
      text: { body: "Tu cita quedó confirmada." },
    });
  });

  test("plantilla: en español, con sus parámetros en orden", async () => {
    const { fetchImpl, sender: s } = sender();
    await s.sendTemplate("51900000001", "cita_vencida", ["Pedro", "lun 16 nov, 10:00"]);
    expect(sentBody(fetchImpl).template).toEqual({
      name: "cita_vencida",
      language: { code: "es" },
      components: [{ type: "body", parameters: [{ type: "text", text: "Pedro" }, { type: "text", text: "lun 16 nov, 10:00" }] }],
    });
  });

  test("en pruebas puede apuntar a otro servidor", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}"));
    await new WhatsAppCloudSender({ token: "t", phoneNumberId: "9", apiUrl: "http://localhost:3199" }, fetchImpl).sendText("51900000001", "x");
    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:3199/9/messages");
  });

  test("si Meta rechaza el mensaje, el error dice por qué", async () => {
    const { sender: s } = sender(400, '{"error":{"message":"Template name does not exist"}}');
    await expect(s.sendText("51900000001", "hola")).rejects.toThrow(/400.*Template name does not exist/);
  });
});

describe("isSignedByMeta", () => {
  const body = '{"object":"whatsapp_business_account"}';
  const sign = (text: string, secret = "secreto") => `sha256=${createHmac("sha256", secret).update(text).digest("hex")}`;

  test("acepta el cuerpo firmado con el secreto de la app", () => {
    expect(isSignedByMeta(body, sign(body), "secreto")).toBe(true);
  });

  test.each([
    ["sin cabecera", null],
    ["otro secreto", sign(body, "otro")],
    ["el cuerpo cambiado", sign(`${body} `)],
    ["sin el prefijo sha256=", sign(body).slice(7)],
    ["basura", "sha256=zz"],
  ])("rechaza %s", (_, header) => {
    expect(isSignedByMeta(body, header, "secreto")).toBe(false);
  });
});

test("readWhatsAppConfig exige las cuatro variables", () => {
  const env = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_APP_SECRET: "s", WHATSAPP_VERIFY_TOKEN: "v" };
  expect(readWhatsAppConfig(env)).toEqual({ token: "t", phoneNumberId: "1", appSecret: "s", verifyToken: "v" });
  expect(readWhatsAppConfig({ ...env, WHATSAPP_APP_SECRET: "" })).toBeNull();
  expect(readWhatsAppConfig({ ...env, WHATSAPP_API_URL: "http://localhost:3199" })?.apiUrl).toBe("http://localhost:3199");
});
