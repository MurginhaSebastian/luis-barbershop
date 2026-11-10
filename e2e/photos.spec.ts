import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { PANEL_PASSWORD, resetCatalog, withE2eDatabase } from "./database";

test.beforeEach(() => resetCatalog());
test.afterAll(() => resetCatalog());

async function login(page: Page) {
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
}

/** Una foto de móvil de verdad: grande y con metadatos. */
const phonePhoto = async () =>
  sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 140, g: 90, b: 50 } } })
    .withExif({ IFD0: { Make: "Teléfono de prueba", Copyright: "Dueño" } })
    .jpeg()
    .toBuffer();

const storedImages = () =>
  withE2eDatabase(async (db) => (await db.query("SELECT data->'images' AS images FROM site_settings")).rows[0]?.images ?? {});

async function uploadTo(page: Page, slot: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto("/panel/web");
  const form = page.getByRole("form", { name: `Subir foto: ${slot}` });
  await form.getByLabel(/Nueva foto/).setInputFiles(file);
  await form.getByRole("button", { name: "Subir foto" }).click();
  return form;
}

test("una foto subida se ve en la portada, reducida a WebP y sin metadatos", async ({ page, request }) => {
  await login(page);
  const form = await uploadTo(page, "Portada", { name: "local.jpg", mimeType: "image/jpeg", buffer: await phonePhoto() });
  await expect(form.getByText("Foto actualizada")).toBeVisible();

  const { hero } = await storedImages();
  expect(hero).toMatch(/^\/imagenes\/[0-9a-f-]{36}\.webp$/);

  const served = await request.get(hero);
  expect(served.headers()["content-type"]).toBe("image/webp");
  const meta = await sharp(await served.body()).metadata();
  expect(meta.format).toBe("webp");
  expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  expect(meta.exif).toBeUndefined();

  await page.goto("/");
  const heroImage = page.locator("section").first().locator("img").first();
  await expect(heroImage).toHaveAttribute("src", new RegExp(encodeURIComponent(hero)));
  expect(await heroImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("un archivo que no es foto se rechaza aunque se llame .jpg", async ({ page }) => {
  await login(page);
  const form = await uploadTo(page, "Portada", {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("<html><script>alert(1)</script></html>"),
  });
  await expect(form.getByRole("alert")).toContainText("JPG, PNG o WebP");
  expect(await storedImages()).toEqual({});
});

test("la foto de un servicio se ve en su mosaico y se puede quitar", async ({ page }) => {
  await login(page);
  const form = await uploadTo(page, "Servicio: Fade", { name: "fade.png", mimeType: "image/png", buffer: await sharp(await phonePhoto()).png().toBuffer() });
  await expect(form.getByText("Foto actualizada")).toBeVisible();

  await page.goto("/");
  const tile = page.getByRole("link", { name: /Fade/ }).locator("img");
  await expect(tile).toHaveAttribute("src", /%2Fimagenes%2F/);

  await page.goto("/panel/web");
  const item = page.getByRole("listitem").filter({ hasText: "Servicio: Fade" });
  await item.getByRole("button", { name: "Volver a la foto de ejemplo" }).click();
  await expect(item.getByText("Vuelve a verse la foto de ejemplo.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Fade/ }).locator("img")).toHaveAttribute("src", /maquina\.jpg/);
});

test("la ruta de fotos no sirve nada fuera de su carpeta", async ({ request }) => {
  for (const path of ["/imagenes/..%2F..%2Fpackage.json", "/imagenes/..%5C.env", "/imagenes/noexiste.webp", "/imagenes/%2e%2e%2f.env"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
