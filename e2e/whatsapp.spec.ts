import { createHmac } from "node:crypto";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { E2E_WHATSAPP, resetBookings, withE2eDatabase } from "./database";
import { clearMeta, sentToMeta } from "./fake-meta";
import { bookUntilData, fillData, newPhone } from "./helpers";

// La reserva de punta a punta con WhatsApp: la web habla con un "Meta" falso (e2e/fake-meta.ts) y aquí se
// hace de Meta para entregar el mensaje del cliente al webhook, firmado como lo firmaría Meta.

// El número conectado a la API: aparte del WhatsApp de Luis, que no hace falta para confirmar.
const CONFIRMATION_NUMBER = E2E_WHATSAPP.displayNumber;

test.beforeEach(async () => {
  await resetBookings();
  await clearMeta();
});

/** Reserva y devuelve la hora elegida, el celular y el código que muestra la web. */
async function bookAndReadCode(page: Page) {
  const phone = newPhone();
  const hour = await bookUntilData(page);
  await fillData(page, phone);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  const href = decodeURIComponent((await page.getByRole("link", { name: "Confirmar por WhatsApp" }).getAttribute("href")) ?? "");
  expect(href).toMatch(new RegExp(`^https://wa\\.me/${CONFIRMATION_NUMBER}\\?text=Confirmo mi cita [A-Z]{3}\\d{3}$`));
  return { hour, phone: `51${phone}`, code: href.slice(-6) };
}

/** Entrega al webhook un mensaje del cliente, firmado como lo firmaría Meta (texto o botón de una plantilla). */
function signedMessage(message: Record<string, unknown>) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: CONFIRMATION_NUMBER, phone_number_id: E2E_WHATSAPP.phoneNumberId },
              messages: [{ timestamp: "1762900000", ...message }],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac("sha256", E2E_WHATSAPP.appSecret).update(body).digest("hex")}`;
  return { body, signature };
}

const runCycle = async (request: APIRequestContext) =>
  (await request.get("/api/cron/vencer", { headers: { authorization: `Bearer ${E2E_WHATSAPP.cronSecret}` } })).json();

/** Mueve la cita del cliente para que empiece dentro de esos minutos (en vez de esperar). */
const startsIn = (phone: string, minutes: number) =>
  withE2eDatabase((db) =>
    db.query(
      `UPDATE appointments SET starts_at = now() + make_interval(mins => $2), ends_at = now() + make_interval(mins => $2 + 30)
       WHERE customer_id = (SELECT id FROM customers WHERE phone = $1)`,
      [phone, minutes],
    ),
  );

const status = (phone: string) =>
  withE2eDatabase(async (db) => {
    const { rows } = await db.query(
      "SELECT a.status FROM appointments a JOIN customers c ON c.id = a.customer_id WHERE c.phone = $1",
      [phone],
    );
    return rows.map((r) => r.status);
  });

test("el cliente confirma por WhatsApp y la cita queda confirmada", async ({ page, request }) => {
  const { phone, code } = await bookAndReadCode(page);
  expect(await status(phone)).toEqual(["PENDING"]);

  const { body, signature } = signedMessage({ from: phone, id: `wamid.${code}`, type: "text", text: { body: `Confirmo mi cita ${code}` } });
  const deliver = () =>
    request.post("/api/whatsapp", { data: body, headers: { "content-type": "application/json", "x-hub-signature-256": signature } });

  expect((await deliver()).status()).toBe(200);
  expect(await status(phone)).toEqual(["CONFIRMED"]);
  expect(await sentToMeta()).toEqual([
    expect.objectContaining({ to: `+${phone}`, type: "text", text: { body: expect.stringContaining("quedó confirmada") } }),
  ]);

  // Meta reintenta el mismo aviso: no se responde dos veces.
  expect((await deliver()).status()).toBe(200);
  expect(await sentToMeta()).toHaveLength(1);

  // Sin la firma de Meta no se atiende.
  const forged = await request.post("/api/whatsapp", { data: body, headers: { "content-type": "application/json" } });
  expect(forged.status()).toBe(401);
});

test("a los -35 min se le pide confirmar y tocar 'Sí, voy' en WhatsApp la confirma", async ({ page, request }) => {
  const { phone, code } = await bookAndReadCode(page);
  await startsIn(phone, 30);

  expect((await request.get("/api/cron/vencer")).status()).toBe(401);
  expect(await runCycle(request)).toEqual({ reminded: 1, atRisk: 0, expired: 0, failed: 0 });
  const [reminder] = await sentToMeta();
  expect(reminder).toMatchObject({ to: `+${phone}`, type: "template", template: { name: "recordatorio_cita" } });
  expect(JSON.stringify(reminder)).toContain(`"payload":"Confirmo mi cita ${code}"`);
  // El siguiente ciclo no lo repite.
  expect(await runCycle(request)).toMatchObject({ reminded: 0 });

  // El botón de la plantilla llega como type "button" con el texto que se le puso.
  const tap = signedMessage({ from: phone, id: `wamid.boton${code}`, type: "button", button: { payload: `Confirmo mi cita ${code}`, text: "Sí, voy" } });
  const res = await request.post("/api/whatsapp", { data: tap.body, headers: { "content-type": "application/json", "x-hub-signature-256": tap.signature } });
  expect(res.status()).toBe(200);
  expect(await status(phone)).toEqual(["CONFIRMED"]);
});

test("si no confirma, a los -15 min queda en riesgo y a su hora vence", async ({ page, request }) => {
  const { phone } = await bookAndReadCode(page);
  await startsIn(phone, 10);
  expect(await runCycle(request)).toEqual({ reminded: 0, atRisk: 1, expired: 0, failed: 0 });
  expect(await status(phone)).toEqual(["AT_RISK"]);

  await startsIn(phone, -1);
  expect(await runCycle(request)).toEqual({ reminded: 0, atRisk: 0, expired: 1, failed: 0 });
  expect(await status(phone)).toEqual(["EXPIRED"]);
});

test("otro cliente puede tomar una hora en riesgo y al primero se le avisa", async ({ page }) => {
  const { hour, phone } = await bookAndReadCode(page);
  // En riesgo sin esperar a que falten 15 min: así el resto del flujo es la reserva real.
  await withE2eDatabase((db) => db.query("UPDATE appointments SET status = 'AT_RISK'"));
  await clearMeta();

  expect(await bookUntilData(page)).toBe(hour);
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: /Reserva (registrada|confirmada)/ })).toBeVisible();

  expect(await status(phone)).toEqual(["EXPIRED"]);
  await expect
    .poll(sentToMeta)
    .toContainEqual(expect.objectContaining({ to: `+${phone}`, type: "template", template: expect.objectContaining({ name: "cita_vencida" }) }));
});
