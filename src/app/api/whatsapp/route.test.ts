import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "./route";

const CONFIG = { token: "t", phoneNumberId: "PHONE1", appSecret: "secreto", verifyToken: "verificame", displayNumber: "51911111111" };

const mocks = vi.hoisted(() => ({
  config: null as null | typeof CONFIG,
  handleMessage: vi.fn(),
  notifyConfirmed: vi.fn(),
  afterResponse: [] as (() => unknown)[],
}));
vi.mock("@/infrastructure/container", () => ({
  getWhatsAppConfig: () => mocks.config,
  getUseCases: () => ({
    bookingConfirmation: { handleMessage: mocks.handleMessage },
    managePush: { notifyConfirmed: mocks.notifyConfirmed },
  }),
}));
vi.mock("next/server", () => ({ after: (task: () => unknown) => mocks.afterResponse.push(task) }));

const URL_BASE = "https://barberia.example/api/whatsapp";

function textMessage(body: string, { phoneNumberId = "PHONE1", from = "51900000001", id = "wamid.1" } = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "51900000000", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Pedro" }, wa_id: from }],
              messages: [{ from, id, timestamp: "1762900000", type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  };
}

function post(payload: unknown, { secret = "secreto", raw }: { secret?: string; raw?: string } = {}) {
  const body = raw ?? JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return POST(new Request(URL_BASE, { method: "POST", body, headers: { "x-hub-signature-256": signature } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config = CONFIG;
  mocks.afterResponse.length = 0;
  mocks.handleMessage.mockResolvedValue({ kind: "no-code" });
});

describe("verificación de Meta (GET)", () => {
  const verify = (token: string) =>
    GET(new Request(`${URL_BASE}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`));

  test("con el token correcto devuelve el desafío", async () => {
    const response = verify("verificame");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  test("con otro token, o sin WhatsApp configurado, se niega", () => {
    expect(verify("otro").status).toBe(403);
    mocks.config = null;
    expect(verify("verificame").status).toBe(403);
  });
});

describe("avisos de Meta (POST)", () => {
  test("un mensaje de texto firmado llega al caso de uso con su número y su texto", async () => {
    const response = await post(textMessage("Confirmo mi cita KRT482"));
    expect(response.status).toBe(200);
    expect(mocks.handleMessage).toHaveBeenCalledWith({ id: "wamid.1", from: "51900000001", text: "Confirmo mi cita KRT482" });
  });

  test("sin firma válida no se atiende nada", async () => {
    expect((await post(textMessage("Confirmo mi cita KRT482"), { secret: "otro" })).status).toBe(401);
    const unsigned = await POST(new Request(URL_BASE, { method: "POST", body: JSON.stringify(textMessage("hola")) }));
    expect(unsigned.status).toBe(401);
    expect(mocks.handleMessage).not.toHaveBeenCalled();
  });

  test("sin WhatsApp configurado el webhook no existe", async () => {
    mocks.config = null;
    expect((await post(textMessage("hola"))).status).toBe(404);
  });

  test("un cuerpo firmado que no es JSON es un error del que llama", async () => {
    expect((await post(null, { raw: "{no es json" })).status).toBe(400);
  });

  test("los estados de entrega y otros tipos de aviso se aceptan sin hacer nada", async () => {
    const status = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "wamid.9", status: "read" }] } }] }] };
    expect((await post(status)).status).toBe(200);
    expect((await post({ object: "page", entry: [] })).status).toBe(200);
    expect(mocks.handleMessage).not.toHaveBeenCalled();
  });

  test("mensajes de otro número del negocio, fotos o sin remitente se ignoran", async () => {
    await post(textMessage("Confirmo mi cita KRT482", { phoneNumberId: "OTRO" }));
    const image = textMessage("x");
    image.entry[0].changes[0].value.messages[0].type = "image";
    await post(image);
    const noSender = textMessage("Confirmo mi cita KRT482");
    delete (noSender.entry[0].changes[0].value.messages[0] as { from?: string }).from;
    await post(noSender);
    expect(mocks.handleMessage).not.toHaveBeenCalled();
  });

  test("al confirmar, avisa al barbero después de responder", async () => {
    const appointment = { id: "a1" };
    mocks.handleMessage.mockResolvedValue({ kind: "confirmed", appointment });
    mocks.notifyConfirmed.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
    await post(textMessage("Confirmo mi cita KRT482"));
    expect(mocks.notifyConfirmed).not.toHaveBeenCalled();
    await mocks.afterResponse[0]();
    expect(mocks.notifyConfirmed).toHaveBeenCalledWith(appointment);
  });

  test("si algo falla responde 500 para que Meta reintente", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.handleMessage.mockRejectedValue(new Error("base caída"));
    expect((await post(textMessage("Confirmo mi cita KRT482"))).status).toBe(500);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
