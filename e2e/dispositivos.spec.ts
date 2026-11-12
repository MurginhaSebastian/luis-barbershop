import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { resetBookings } from "./database";
import { bookUntilData, fillData } from "./helpers";

// Se ejecuta con `npm run test:devices` (playwright.devices.config.ts), una vez por dispositivo.

test.beforeEach(() => resetBookings());

/** Lo que tiene que cumplir cualquier página en cualquier pantalla. */
async function expectSoundLayout(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    header: document.querySelector("body > header")?.getBoundingClientRect().height ?? 0,
    brokenFonts: [...document.fonts].filter((f) => f.status === "error").map((f) => f.family),
  }));
  expect(layout.overflow, "desplazamiento horizontal").toBeLessThanOrEqual(0);
  // Una sola línea: el nombre no salta a dos renglones ni empuja los botones.
  expect(layout.header, "alto de la cabecera").toBeLessThanOrEqual(80);
  expect(layout.brokenFonts, "fuentes que no cargaron").toEqual([]);
}

/** Captura de página completa para revisarla a ojo, tras recorrerla para que carguen las fotos diferidas. */
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  // Queda en test-results/<prueba>-<dispositivo>/<nombre>.png, con cualquier reportero.
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("portada: se ve entera, con el nombre y la reserva a la vista", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto("/");
  const hero = page.locator("section").first();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await expect(hero.getByRole("link", { name: "Reservar cita" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Servicios", level: 2 })).toBeAttached();
  await expectSoundLayout(page);

  // El video se reproduce o, si el motor no puede (WebKit en Windows no trae H.264), queda el póster.
  const playing = await page
    .waitForFunction(() => {
      const v = document.querySelector("video");
      return !!v && !v.paused && v.currentTime > 0.3;
    }, undefined, { timeout: 6000 })
    .then(() => true, () => false);
  const poster = await hero.locator("img").first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
  testInfo.annotations.push({ type: "video", description: playing ? "se reproduce" : "no se reproduce; se ve el póster" });
  expect(playing || poster, "video o póster").toBe(true);

  await capture(page, testInfo, "portada");
  expect(errors).toEqual([]);
});

test("reserva completa de principio a fin", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await bookUntilData(page);
  await expectSoundLayout(page);
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  await expectSoundLayout(page);
  await capture(page, testInfo, "reserva-confirmada");
  expect(errors).toEqual([]);
});

test("entrada al panel", async ({ page }, testInfo) => {
  await page.goto("/panel/entrar");
  await expect(page.getByLabel("Clave")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeInViewport();
  await expectSoundLayout(page);
  await capture(page, testInfo, "panel-entrar");
});
