import { expect, type Page } from "@playwright/test";

let counter = 0;
/** Celular ficticio distinto en cada llamada, para no chocar con el límite de citas. */
export const newPhone = () => `9${String(10_000_000 + counter++)}`;

export async function chooseServices(page: Page, names: RegExp[]) {
  await page.goto("/reservar");
  for (const name of names) await page.getByLabel(name).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Con quién?" })).toBeVisible();
}

export async function chooseBarber(page: Page, name: string | RegExp) {
  await page.getByRole("main").getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
}

/** Un día con margen (no el primero, que podría estar casi agotado por la antelación mínima). */
export async function chooseDay(page: Page, index = 3) {
  const day = page.getByRole("list", { name: "Elige el día" }).getByRole("link").nth(index);
  await day.click();
  await expect(day).toHaveAttribute("aria-current", "date");
}

export async function chooseFirstHour(page: Page) {
  const hour = page.getByRole("region", { name: "Mañana" }).getByRole("link").first();
  const label = await hour.innerText();
  await hour.click();
  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  return label;
}

export async function fillData(page: Page, phone = newPhone()) {
  await page.getByLabel("Nombre").fill("Cliente Prueba");
  await page.getByLabel(/Celular/).fill(phone);
}

export async function bookUntilData(page: Page, barber: string | RegExp = "Luis") {
  await chooseServices(page, [/Corte clásico/]);
  await chooseBarber(page, barber);
  await chooseDay(page);
  return chooseFirstHour(page);
}
