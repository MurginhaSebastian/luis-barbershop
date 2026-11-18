import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { PANEL_PASSWORD, resetBookings, seedAgendaDay } from "./database";
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

test("agenda del panel: el calendario cabe y nada se tapa", async ({ page, browserName }, testInfo) => {
  // La cookie del panel es Secure en producción (next start) y WebKit no la guarda en http://localhost; con
  // HTTPS sí. El diseño en 320 px lo cubren Galaxy S9+ y Pixel.
  test.skip(browserName === "webkit", "WebKit no guarda cookies Secure en http://localhost");
  const errors = collectErrors(page);
  const day = await seedAgendaDay();
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
  await page.goto(`/panel?dia=${day}`);
  const section = page.locator('section[aria-labelledby="agenda-dia"]');
  const events = section.getByRole("button", { name: /^\d{2}:\d{2} .+, / });
  await expect(events).toHaveCount(4);
  const boxes = await events.evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().toJSON()));
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      const apart = a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left;
      expect(apart, "dos citas se tapan").toBe(true);
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "desplazamiento horizontal").toBeLessThanOrEqual(0);
  await capture(page, testInfo, "panel-agenda-dia");

  await events.filter({ hasText: "Cliente largo" }).click();
  await expect(page.getByRole("dialog", { name: "Cita de Cliente largo" })).toBeVisible();
  await capture(page, testInfo, "panel-agenda-ficha");
  await page.keyboard.press("Escape");

  await page.goto(`/panel?vista=semana&dia=${day}`);
  await expect(events).toHaveCount(4);
  await capture(page, testInfo, "panel-agenda-semana");
  await page.goto(`/panel?vista=mes&dia=${day}`);
  await expect(section.getByRole("link", { name: "+1 más" })).toBeVisible();
  await capture(page, testInfo, "panel-agenda-mes");
  expect(errors).toEqual([]);
});

test("entrada al panel", async ({ page }, testInfo) => {
  await page.goto("/panel/entrar");
  await expect(page.getByLabel("Clave")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeInViewport();
  await expectSoundLayout(page);
  await capture(page, testInfo, "panel-entrar");
});
