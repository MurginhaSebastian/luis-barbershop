import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
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
              messages: [{ from: phone, id: `wamid.${code}`, timestamp: "1762900000", type: "text", text: { body: `Confirmo mi cita ${code}` } }],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac("sha256", E2E_WHATSAPP.appSecret).update(body).digest("hex")}`;
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

test("si nadie confirma a tiempo, la hora vuelve a estar libre para otros", async ({ page, request }) => {
  const { hour, phone } = await bookAndReadCode(page);
  // El plazo ya pasó (en vez de esperar dos horas).
  await withE2eDatabase((db) => db.query("UPDATE booking_confirmations SET confirm_by = now() - interval '1 minute'"));

  expect((await request.get("/api/cron/vencer")).status()).toBe(401);
  const run = await request.get("/api/cron/vencer", { headers: { authorization: `Bearer ${E2E_WHATSAPP.cronSecret}` } });
  expect(await run.json()).toEqual({ expired: 1, failed: 0 });
  expect(await status(phone)).toEqual(["EXPIRED"]);
  expect(await sentToMeta()).toEqual([
    expect.objectContaining({ to: `+${phone}`, type: "template", template: expect.objectContaining({ name: "cita_vencida" }) }),
  ]);

  // Otro cliente ve libre la misma hora que se acaba de liberar.
  expect(await bookUntilData(page)).toBe(hour);
});
