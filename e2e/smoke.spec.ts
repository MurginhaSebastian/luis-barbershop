import { expect, test } from "@playwright/test";

test("la portada carga el catálogo desde la base de pruebas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Servicios" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Corte clásico/ })).toBeVisible();
});
