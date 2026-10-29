import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (ver .env.example).");
  return drizzle(url, { schema });
}

export type Db = ReturnType<typeof createDb>;

let db: Db | undefined;

/** Pool único por proceso, creado al primer uso para que el build no necesite base de datos. */
export function getDb(): Db {
  return (db ??= createDb());
}
