import { Client } from "pg";

const E2E_DB = "barbershop_e2e";

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
