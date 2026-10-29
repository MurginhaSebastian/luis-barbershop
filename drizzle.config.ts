import { defineConfig } from "drizzle-kit";

// drizzle-kit no lee .env por su cuenta; Next sí, así que esto solo afecta a la CLI.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/db/schema.ts",
  out: "./src/infrastructure/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
