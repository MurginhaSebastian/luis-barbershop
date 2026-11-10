import { readFileSync, rmSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { E2E_UPLOADS_DIR, e2eDatabaseUrl, recreateE2eDatabase, withE2eDatabase } from "./database";

export default async function globalSetup() {
  await recreateE2eDatabase();
  rmSync(E2E_UPLOADS_DIR, { recursive: true, force: true });
  const db = drizzle(e2eDatabaseUrl());
  await migrate(db, { migrationsFolder: "src/infrastructure/db/migrations" });
  await db.$client.end();
  await withE2eDatabase((client) => client.query(readFileSync("src/infrastructure/db/seed.sql", "utf8")));
}
