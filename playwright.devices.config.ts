import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// La web en otros motores y pantallas: `npm run test:devices`. Safari y Firefox necesitan, una vez,
// `npx playwright install webkit firefox`; los móviles Android usan Edge, que es Chromium.
const PORT = 3101;

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "dispositivos.spec.ts",
  // Sin el canal de Edge de la configuración base: WebKit y Firefox usan su propio motor.
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "iPhone 15", use: { ...devices["iPhone 15"] } },
    { name: "iPad Mini", use: { ...devices["iPad Mini"] } },
    { name: "Safari escritorio", use: { ...devices["Desktop Safari"] } },
    { name: "Pixel 7", use: { ...devices["Pixel 7"], channel: "msedge" } },
    { name: "Galaxy S9+", use: { ...devices["Galaxy S9+"], channel: "msedge" } },
    { name: "Firefox escritorio", use: { ...devices["Desktop Firefox"] } },
    { name: "Edge 1920", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    ...base.webServer,
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/icon.svg`,
  },
});
