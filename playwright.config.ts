import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/database";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Un solo trabajador: las pruebas comparten agenda y se vaciaría entre ellas.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Edge ya viene con Windows: no hay que descargar navegadores.
    channel: "msedge",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "movil", use: { ...devices["Desktop Edge"], viewport: { width: 375, height: 812 } } },
    { name: "escritorio", use: { ...devices["Desktop Edge"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    // Contra el build real, no el de desarrollo, y con una base aparte.
    command: `npm run build && npx next start -p ${PORT}`,
    // Un archivo estático: la base de pruebas aún no existe cuando esto se comprueba.
    url: `http://localhost:${PORT}/icon.svg`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: e2eDatabaseUrl() },
  },
});
