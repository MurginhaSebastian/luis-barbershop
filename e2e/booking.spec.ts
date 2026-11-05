import { expect, test } from "@playwright/test";
import { resetBookings, withE2eDatabase } from "./database";
import { bookUntilData, chooseBarber, chooseDay, chooseFirstHour, chooseServices, fillData, newPhone } from "./helpers";

test.beforeEach(() => resetBookings());

const lastAppointment = () =>
  withE2eDatabase(async (db) => {
    const { rows } = await db.query(
      `SELECT a.status, b.name AS barber, c.phone,
        (SELECT count(*)::int FROM appointment_services s WHERE s.appointment_id = a.id) AS services,
        (SELECT coalesce(sum(quantity), 0)::int FROM appointment_products p WHERE p.appointment_id = a.id) AS products
       FROM appointments a JOIN barbers b ON b.id = a.barber_id JOIN customers c ON c.id = a.customer_id
       ORDER BY a.created_at DESC LIMIT 1`,
    );
    return rows[0];
  });

test("reserva completa con un barbero concreto", async ({ page }) => {
  await chooseServices(page, [/Corte clásico/, /Perfilado de barba/]);
  await expect(page.getByLabel("Resumen de tu reserva")).toContainText("S/ 50.00");
  await chooseBarber(page, "Luis");
  await chooseDay(page);
  await chooseFirstHour(page);

  await fillData(page, "900 000 777");
  await page.getByRole("button", { name: "Añadir Cera mate" }).click();
  await expect(page.getByLabel("Resumen de tu reserva")).toContainText("S/ 85.00");
  await page.getByRole("button", { name: "Reservar cita" }).click();

  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  await expect(page.getByText("Con Luis")).toBeVisible();
  await expect(page.getByText("S/ 85.00")).toBeVisible();
  expect(await lastAppointment()).toEqual({
    status: "PENDING",
    barber: "Luis",
    phone: "51900000777",
    services: 2,
    products: 1,
  });

  // Recargar tras reservar no debe dejar al cliente en una hora que ya es suya.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();
});

test("sin preferencia asigna un barbero y lo muestra", async ({ page }) => {
  await bookUntilData(page, /Sin preferencia/);
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

  const { barber } = await lastAppointment();
  await expect(page.getByText(`Con ${barber}`)).toBeVisible();
});

test("sin preferencia sigue ofreciendo una hora si solo un barbero está ocupado", async ({ page }) => {
  const hour = await bookUntilData(page, "Luis");
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

  await chooseServices(page, [/Corte clásico/]);
  await chooseBarber(page, "Luis");
  await chooseDay(page);
  await expect(page.getByRole("link", { name: hour, exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Atrás" }).click();
  await chooseBarber(page, /Sin preferencia/);
  await chooseDay(page);
  await expect(page.getByRole("link", { name: hour, exact: true })).toHaveCount(1);
});

test("sin servicios no se puede continuar", async ({ page }) => {
  await page.goto("/reservar");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.getByLabel(/Cejas/).check();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("se puede volver atrás sin perder lo elegido", async ({ page }) => {
  await bookUntilData(page);

  await page.getByRole("link", { name: "Atrás" }).click();
  await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();

  await page.getByRole("link", { name: "Volver a Servicios" }).click();
  await expect(page.getByLabel(/Corte clásico/)).toBeChecked();

  // El botón Atrás del navegador también funciona.
  await page.goBack();
  await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
});

test("cambiar de servicio obliga a elegir la hora de nuevo", async ({ page }) => {
  await bookUntilData(page);
  await page.getByRole("link", { name: "Volver a Servicios" }).click();
  await page.getByLabel(/Fade/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await chooseBarber(page, "Luis");
  await expect(page).not.toHaveURL(/hora=/);
});

test("el servicio tocado en la portada llega marcado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Fade/ }).click();
  await expect(page.getByLabel(/Fade/)).toBeChecked();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});

test("una URL manipulada lleva al paso que falta", async ({ page }) => {
  await page.goto("/reservar?paso=4");
  await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();

  await page.goto("/reservar?paso=4&servicios=' OR 1=1&barbero=<script>&hora=ayer");
  await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();

  // Un id con formato válido que no existe en el catálogo.
  await page.goto("/reservar?paso=3&servicios=99999999-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();
});

test("los errores del formulario se ven y no borran lo escrito", async ({ page }) => {
  await bookUntilData(page);
  await page.getByLabel("Nombre").fill("Cliente Prueba");
  await page.getByLabel(/Celular/).fill("12345");
  await page.getByRole("button", { name: "Reservar cita" }).click();

  await expect(page.getByText(/celular de 9 dígitos/)).toBeVisible();
  await expect(page.getByLabel("Nombre")).toHaveValue("Cliente Prueba");
  await expect(page.getByLabel(/Celular/)).toHaveAttribute("aria-invalid", "true");
});

test("si otra persona gana la hora, se ofrece elegir otra", async ({ page, browser }) => {
  await bookUntilData(page);
  await fillData(page);

  const rival = await browser.newPage();
  await bookUntilData(rival);
  await fillData(rival);
  await rival.getByRole("button", { name: "Reservar cita" }).click();
  await expect(rival.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  await rival.close();

  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("ya no está disponible");
  await page.getByRole("link", { name: "Elegir otra hora" }).click();
  await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
});

test("una hora ya ocupada en la URL vuelve al paso de horas con aviso", async ({ page }) => {
  await bookUntilData(page);
  const url = page.url();
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

  await page.goto(url);
  await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Esa hora ya no está libre");
});

test("un celular no puede tener más de 2 citas activas", async ({ page }) => {
  const phone = newPhone();
  for (const dayIndex of [3, 4]) {
    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Luis");
    await chooseDay(page, dayIndex);
    await chooseFirstHour(page);
    await fillData(page, phone);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  }

  await chooseServices(page, [/Corte clásico/]);
  await chooseBarber(page, "Luis");
  await chooseDay(page, 5);
  await chooseFirstHour(page);
  await fillData(page, phone);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("ya tiene 2 citas");
});

test("los días cerrados no se pueden elegir", async ({ page }) => {
  await chooseServices(page, [/Corte clásico/]);
  await chooseBarber(page, "Luis");
  const strip = page.getByRole("list", { name: "Elige el día" });
  await expect(strip.getByText("cerrado").first()).toBeVisible();
  await expect(strip.getByRole("link").filter({ hasText: "cerrado" })).toHaveCount(0);

  // Aun forzándolo por la URL, se explica y se ofrece el siguiente día.
  const sunday = new Date();
  do sunday.setUTCDate(sunday.getUTCDate() + 1);
  while (sunday.getUTCDay() !== 0);
  const url = new URL(page.url());
  url.searchParams.set("dia", sunday.toISOString().slice(0, 10));
  await page.goto(url.toString());
  await expect(page.getByText("Ese día la barbería está cerrada.")).toBeVisible();
  await page.getByRole("link", { name: "Ver el siguiente día" }).click();
  await expect(page.getByRole("region", { name: "Mañana" })).toBeVisible();
});
