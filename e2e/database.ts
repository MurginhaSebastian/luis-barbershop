import webpush from "web-push";
import { scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const E2E_DB = "barbershop_e2e";
export const E2E_UPLOADS_DIR = ".uploads-e2e";

// Solo para las pruebas: la base y el servidor de pruebas son locales y efímeros.
export const PANEL_PASSWORD = "clave-solo-para-pruebas";

/** WhatsApp de pruebas: apunta al servidor falso de e2e/fake-meta.ts, nunca a Meta. */
export const E2E_WHATSAPP = {
  appSecret: "secreto-whatsapp-de-pruebas",
  phoneNumberId: "E2E-PHONE",
  cronSecret: "secreto-cron-de-pruebas",
  displayNumber: "51911111111",
};

export function e2eWhatsAppEnv() {
  return {
    WHATSAPP_TOKEN: "token-de-pruebas",
    WHATSAPP_PHONE_NUMBER_ID: E2E_WHATSAPP.phoneNumberId,
    WHATSAPP_APP_SECRET: E2E_WHATSAPP.appSecret,
    WHATSAPP_VERIFY_TOKEN: "verificacion-de-pruebas",
    WHATSAPP_DISPLAY_NUMBER: E2E_WHATSAPP.displayNumber,
    WHATSAPP_API_URL: "http://localhost:3199",
    CRON_SECRET: E2E_WHATSAPP.cronSecret,
    SITE_URL: "http://localhost:3100",
  };
}

export function e2ePanelEnv() {
  const vapid = webpush.generateVAPIDKeys();
  const salt = "e2e";
  return {
    PANEL_PASSWORD_HASH: `${salt}:${scryptSync(PANEL_PASSWORD, salt, 64).toString("hex")}`,
    PANEL_SESSION_SECRET: "secreto-solo-para-pruebas-e2e-0123456789",
    // Claves VAPID nuevas en cada ejecución: los avisos van a un servicio de push inexistente.
    VAPID_SUBJECT: "mailto:pruebas@example.com",
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  };
}

function baseUrl(): string {
  try {
    process.loadEnvFile();
  } catch {}
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (ver .env.example) y Postgres encendido (npm run db:up).");
  return url;
}

/** Base propia de las pruebas: los datos de desarrollo nunca se tocan. */
export function e2eDatabaseUrl(): string {
  const url = new URL(baseUrl());
  url.pathname = `/${E2E_DB}`;
  return url.toString();
}

export async function recreateE2eDatabase(): Promise<void> {
  const admin = new Client({ connectionString: baseUrl() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${E2E_DB}`);
  await admin.end();
}

export async function withE2eDatabase<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: e2eDatabaseUrl() });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Deja la agenda vacía; el catálogo se conserva. */
export function resetBookings(): Promise<void> {
  return withE2eDatabase(async (client) => {
    await client.query("TRUNCATE appointments, customers, schedule_blocks CASCADE");
  });
}

/** Vuelve al catálogo de ejemplo, para las pruebas que lo editan. */
export function resetCatalog(): Promise<void> {
  return withE2eDatabase(async (client) => {
    await client.query("TRUNCATE appointments, customers, schedule_blocks, services, products, barbers, business_hours, site_settings, push_subscriptions, booking_confirmations CASCADE");
    await client.query(readFileSync("src/infrastructure/db/seed.sql", "utf8"));
  });
}

/** El próximo día abierto: una cita en riesgo y la que tomó su hora (se cruzan), una larga y otra de otro barbero. */
export function seedAgendaDay(): Promise<string> {
  const LUIS = "10000000-0000-4000-8000-000000000001";
  const INVITADO = "10000000-0000-4000-8000-000000000002";
  const CORTE = "20000000-0000-4000-8000-000000000001";
  return withE2eDatabase(async (db) => {
    // El próximo día abierto (lunes a sábado en los datos de ejemplo), para que el horario cuente.
    const { rows } = await db.query(
      "SELECT to_char(d, 'YYYY-MM-DD') AS day FROM generate_series((now() AT TIME ZONE 'America/Lima')::date + 1, (now() AT TIME ZONE 'America/Lima')::date + 2, '1 day') AS d WHERE extract(isodow FROM d) < 7 LIMIT 1",
    );
    const day = rows[0].day as string;
    const add = async (n: number, name: string, barber: string, from: string, minutes: number, status: string) => {
      const customer = `30000000-0000-4000-8000-00000000000${n}`;
      const appointment = `40000000-0000-4000-8000-00000000000${n}`;
      const start = new Date(`${day}T${from}:00-05:00`);
      await db.query("INSERT INTO customers (id, name, phone) VALUES ($1, $2, $3)", [customer, name, `5190000010${n}`]);
      await db.query(
        "INSERT INTO appointments (id, barber_id, customer_id, customer_name, starts_at, ends_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [appointment, barber, customer, name, start, new Date(start.getTime() + minutes * 60_000), status],
      );
      await db.query(
        "INSERT INTO appointment_services (appointment_id, position, service_id, name, duration_minutes, price_cents) VALUES ($1, 0, $2, 'Corte clásico', $3, 3000)",
        [appointment, CORTE, minutes],
      );
    };
    await add(1, "Cliente en riesgo", LUIS, "10:00", 45, "AT_RISK");
    await add(2, "Cazador de huecos", LUIS, "10:00", 30, "CONFIRMED");
    await add(3, "Cliente largo", LUIS, "11:30", 120, "PENDING");
    await add(4, "Cliente de invitado", INVITADO, "10:00", 30, "CONFIRMED");
    return day;
  });
}
