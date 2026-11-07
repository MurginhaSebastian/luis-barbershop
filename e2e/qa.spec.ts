import { expect, type Page, test } from "@playwright/test";
import { PANEL_PASSWORD, resetBookings, withE2eDatabase } from "./database";
import { bookUntilData, chooseBarber, chooseDay, chooseFirstHour, chooseServices, fillData, newPhone } from "./helpers";

test.beforeEach(() => resetBookings());

const BASE = "http://localhost:3100";

async function login(page: Page) {
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
}

async function bookAs(page: Page, name: string) {
  await bookUntilData(page);
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel(/Celular/).fill(newPhone());
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
}

const count = (table: string) =>
  withE2eDatabase(async (db) => (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number);

const sql = (query: string) => withE2eDatabase((db) => db.query(query));

test.describe("datos hostiles", () => {
  test("un nombre con código no se ejecuta en el panel", async ({ page }) => {
    const attack = `<img src=x onerror="window.__xss=1">`;
    await bookAs(page, attack);
    await login(page);
    await expect(page.getByRole("article").first()).toContainText(attack);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator("article img")).toHaveCount(0);
  });

  test("un nombre con comillas e intento de SQL se guarda como texto", async ({ page }) => {
    const attack = `Robert'); DROP TABLE customers;--`;
    await bookAs(page, attack);
    expect(await count("customers")).toBe(1);
    const { rows } = await sql("SELECT customer_name FROM appointments");
    expect(rows[0].customer_name).toBe(attack);
  });

  test("un nombre larguísimo sin espacios no rompe el panel en el móvil", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bookAs(page, "A".repeat(60));
    await login(page);
    await expect(page.getByRole("article").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const card = await page.getByRole("article").first().boundingBox();
    expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(375);
  });

  test("una petición falsificada desde otro sitio no crea la cita", async ({ page, request }) => {
    await bookUntilData(page);
    await fillData(page);
    // Se captura el envío real y se repite como si viniera de otra web.
    await page.route("**/reservar**", async (route) => {
      const real = route.request();
      if (real.method() !== "POST") return route.continue();
      const forged = await request.fetch(real, { headers: { ...real.headers(), origin: "https://atacante.example" } });
      expect(forged.status()).toBeGreaterThanOrEqual(400);
      await route.abort();
    });
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect.poll(() => count("appointments")).toBe(0);
    await page.waitForTimeout(500);
    expect(await count("appointments")).toBe(0);
  });
});

test.describe("uso real y torpe", () => {
  test("el doble clic en Reservar crea una sola cita", async ({ page }) => {
    await bookUntilData(page);
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).dblclick();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
    expect(await count("appointments")).toBe(1);
  });

  test("recargar a mitad de la reserva no pierde lo elegido", async ({ page }) => {
    await chooseServices(page, [/Corte clásico/, /Cejas/]);
    await chooseBarber(page, "Luis");
    await chooseDay(page);
    const day = new URL(page.url()).searchParams.get("dia");
    await page.reload();
    await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
    await expect(page.getByLabel("Resumen de tu reserva")).toContainText("S/ 40.00");
    expect(new URL(page.url()).searchParams.get("dia")).toBe(day);
  });

  test("volver atrás tras reservar no duplica la cita", async ({ page }) => {
    await bookUntilData(page);
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toHaveCount(0);
    expect(await count("appointments")).toBe(1);
  });

  test("desde otra zona horaria e idioma, las horas siguen siendo las de Lima", async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: "Asia/Tokyo", locale: "en-US", baseURL: BASE });
    const page = await context.newPage();
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(String(e)));

    const shown = await bookUntilData(page);
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reserva registrada" }).locator("..")).toContainText(shown);

    const { rows } = await sql("SELECT to_char(starts_at AT TIME ZONE 'America/Lima', 'HH24:MI') AS hora FROM appointments");
    expect(rows[0].hora).toBe(shown);
    expect(problems).toEqual([]);
    await context.close();
  });

  test("dos pestañas del panel: la segunda ve un aviso, no un error", async ({ page, context }) => {
    await bookAs(page, "Cliente Prueba");
    await login(page);
    const other = await context.newPage();
    await other.goto("/panel");

    await page.getByRole("button", { name: "Confirmar sin avisar" }).click();
    await expect(page.getByText("Todas las citas están respondidas.")).toBeVisible();

    await other.getByRole("button", { name: "Confirmar sin avisar" }).click();
    await expect(other.getByRole("main").getByRole("alert")).toContainText("ya no admite");
    await other.close();
  });

  test("una fecha imposible en el panel muestra hoy", async ({ page }) => {
    await login(page);
    await page.goto("/panel?dia=2026-02-30");
    await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  });
});

test.describe("catálogo en situaciones raras", () => {
  test.afterEach(() =>
    withE2eDatabase(async (db) => {
      await db.query("UPDATE services SET active = true");
      await db.query("UPDATE barbers SET active = true");
      await db.query("UPDATE products SET active = true");
      await db.query("DELETE FROM business_hours");
      await db.query(`INSERT INTO business_hours (weekday, open_minute, close_minute)
        SELECT d, t.o, t.c FROM generate_series(1, 6) AS d, (VALUES (600, 840), (900, 1200)) AS t(o, c)`);
    }),
  );

  test("lo oculto no se ofrece en la web ni en la reserva", async ({ page }) => {
    await sql("UPDATE services SET active = false WHERE name = 'Fade'");
    await sql("UPDATE barbers SET active = false WHERE name = 'Barbero invitado'");
    await sql("UPDATE products SET active = false WHERE name = 'Cera mate'");

    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.getByRole("link", { name: /Fade/ })).toHaveCount(0);
    await expect(page.getByText("Cera mate")).toHaveCount(0);

    await chooseServices(page, [/Corte clásico/]);
    await expect(page.getByLabel(/Fade/)).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Barbero invitado" })).toHaveCount(0);
    await chooseBarber(page, "Luis");
    await chooseDay(page);
    await chooseFirstHour(page);
    await expect(page.getByRole("button", { name: "Añadir Cera mate" })).toHaveCount(0);
  });

  test("sin servicios la web lo dice y no se puede continuar", async ({ page }) => {
    await sql("UPDATE services SET active = false");
    await page.goto("/");
    await expect(page.getByText("Pronto publicaremos nuestros servicios.")).toBeVisible();
    await page.goto("/reservar");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  test("sin horario configurado la reserva lo explica en vez de romperse", async ({ page }) => {
    await sql("DELETE FROM business_hours");
    await chooseServices(page, [/Corte clásico/]);
    await page.getByRole("main").getByRole("link", { name: "Luis" }).click();
    await expect(page.getByText(/no hay días disponibles/)).toBeVisible();
  });

  test("un barbero de vacaciones no ofrece horas, pero el otro sí", async ({ page }) => {
    await sql(`INSERT INTO schedule_blocks (barber_id, starts_at, ends_at)
      SELECT id, now() - interval '1 day', now() + interval '30 days' FROM barbers WHERE name = 'Luis'`);
    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Luis");
    await expect(page.getByText(/No quedan horas libres ese día con Luis/)).toBeVisible();

    await page.getByRole("link", { name: "Atrás" }).click();
    await chooseBarber(page, "Barbero invitado");
    await chooseDay(page);
    await expect(page.getByRole("region", { name: "Mañana" }).getByRole("link").first()).toBeVisible();
  });
});

test.describe("calidad general", () => {
  test("sin scroll horizontal a 320 px, el mínimo de accesibilidad", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/", "/reservar", "/panel/entrar", "/no-existe"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("ningún enlace interno está roto", async ({ page, request }) => {
    const visited = new Set<string>();
    for (const start of ["/", "/reservar", "/panel/entrar"]) {
      await page.goto(start);
      await page.waitForLoadState("networkidle");
      const hrefs = await page.locator("a[href^='/']").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      for (const href of hrefs) visited.add(href.split("#")[0] || "/");
    }
    expect(visited.size).toBeGreaterThan(3);
    for (const href of visited) {
      expect((await request.get(href)).status(), href).toBeLessThan(400);
    }
  });

  test("cada página tiene idioma, título propio y un solo h1", async ({ page }) => {
    const titles = new Set<string>();
    for (const path of ["/", "/reservar", "/panel/entrar"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(page.locator("h1"), path).toHaveCount(1);
      titles.add(await page.title());
    }
    expect(titles.size).toBe(3);
  });

  test("los enlaces externos no dan acceso a la página original", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    const unsafe = await page
      .locator("a[target=_blank]")
      .evaluateAll((links) => links.filter((a) => !a.getAttribute("rel")?.includes("noopener")).map((a) => a.outerHTML.slice(0, 80)));
    expect(unsafe).toEqual([]);
  });
});
