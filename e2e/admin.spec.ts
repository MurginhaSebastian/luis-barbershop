import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { PANEL_PASSWORD, resetCatalog } from "./database";
import { bookUntilData, chooseBarber, chooseServices, fillData } from "./helpers";

test.beforeEach(() => resetCatalog());
test.afterAll(() => resetCatalog());

async function login(page: Page) {
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
}

const card = (page: Page, name: string) => page.getByRole("form", { name });

/** El próximo lunes con margen, como "YYYY-MM-DD": abierto en los datos de ejemplo y dentro del plazo. */
function nextMonday() {
  const day = new Date(Date.now() + 3 * 86_400_000);
  while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

test.describe("acceso", () => {
  for (const path of ["/panel/servicios", "/panel/productos", "/panel/barberos", "/panel/horario", "/panel/web"]) {
    test(`${path} exige sesión`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/panel\/entrar$/);
    });
  }

  test("la navegación lleva a cada sección", async ({ page }) => {
    await login(page);
    const nav = page.getByRole("navigation", { name: "Secciones del panel" });
    for (const name of ["Servicios", "Productos", "Barberos", "Horario", "Web"]) {
      await nav.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("servicios", () => {
  test("un servicio nuevo aparece en la web y en la reserva", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = card(page, "Añadir servicio");
    await form.getByLabel("Nombre").fill("Tinte de barba");
    await form.getByLabel("Duración (minutos)").fill("20");
    await form.getByLabel("Precio (S/)").fill("25.50");
    await form.getByRole("button", { name: "Añadir" }).click();

    await expect(card(page, "Tinte de barba")).toBeVisible();
    await expect(form.getByLabel("Nombre")).toHaveValue("");

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Tinte de barba/ })).toContainText("S/ 25.50");
    await page.goto("/reservar");
    await expect(page.getByLabel(/Tinte de barba/)).toBeVisible();
  });

  test("cambiar un precio se ve en la web, y la cita ya reservada conserva el suyo", async ({ page }) => {
    await bookUntilData(page);
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

    await login(page);
    await page.goto("/panel/servicios");
    const form = card(page, "Corte clásico");
    await form.getByLabel("Precio (S/)").fill("99");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Corte clásico/ })).toContainText("S/ 99.00");
    await page.goto("/panel");
    await expect(page.getByRole("article").first()).toContainText("S/ 30.00");
  });

  test("ocultar un servicio lo quita de la web sin perderlo en el panel", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = card(page, "Fade");
    await form.getByLabel("Visible en la web").uncheck();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();

    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.getByRole("link", { name: /Fade/ })).toHaveCount(0);
    await page.goto("/panel/servicios");
    await expect(card(page, "Fade").getByLabel("Visible en la web")).not.toBeChecked();
  });

  test("un dato inválido se explica y no borra lo escrito", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = card(page, "Corte clásico");
    await form.getByLabel("Precio (S/)").fill("gratis");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByRole("alert")).toContainText("precio en soles");
    await expect(form.getByLabel("Precio (S/)")).toHaveValue("gratis");

    await form.getByLabel("Precio (S/)").fill("30");
    await form.getByLabel("Duración (minutos)").fill("32");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByRole("alert")).toContainText("de 5 en 5");
  });
});

test("un producto oculto deja de ofrecerse al reservar", async ({ page }) => {
  await login(page);
  await page.goto("/panel/productos");
  const form = card(page, "Cera mate");
  await form.getByLabel("Visible en la web").uncheck();
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Guardado.")).toBeVisible();

  await bookUntilData(page);
  await expect(page.getByRole("button", { name: "Añadir Cera mate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Añadir Aceite para barba" })).toBeVisible();
});

test.describe("barberos", () => {
  test("un barbero nuevo se puede elegir al reservar", async ({ page }) => {
    await login(page);
    await page.goto("/panel/barberos");
    const form = card(page, "Añadir barbero");
    await form.getByLabel("Nombre").fill("Barbero Nuevo");
    await form.getByRole("button", { name: "Añadir" }).click();
    await expect(card(page, "Barbero Nuevo")).toBeVisible();

    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Barbero Nuevo");
  });

  test("ocultar a un barbero con citas avisa, y deja de ofrecerse", async ({ page }) => {
    await bookUntilData(page);
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

    await login(page);
    await page.goto("/panel/barberos");
    const form = card(page, "Luis");
    await form.getByLabel("Visible en la web").uncheck();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText(/1 cita por venir/)).toBeVisible();

    await chooseServices(page, [/Corte clásico/]);
    await expect(page.getByRole("main").getByRole("link", { name: "Luis", exact: true })).toHaveCount(0);
  });
});

test.describe("horario", () => {
  test("cerrar un día lo marca cerrado en la reserva y en la web", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const monday = card(page, "Lunes");
    for (const label of ["Abre", "Cierra", "Abre (2.º tramo)", "Cierra (2.º tramo)"]) {
      await monday.getByLabel(label, { exact: true }).fill("");
    }
    await monday.getByRole("button", { name: "Guardar" }).click();
    await expect(monday.getByText("Guardado.")).toBeVisible();
    await expect(monday.getByText("Cerrado")).toBeVisible();

    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Luis");
    const strip = page.getByRole("list", { name: "Elige el día" });
    await expect(strip.getByText("cerrado")).toHaveCount(await strip.getByText(/^lun$|^dom$/i).count());

    await page.goto("/");
    await expect(page.getByText("Martes a sábado")).toBeVisible();
  });

  test("cambiar el horario cambia las horas que se ofrecen", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const monday = card(page, "Lunes");
    await monday.getByLabel("Abre", { exact: true }).fill("11:00");
    await monday.getByLabel("Cierra", { exact: true }).fill("12:00");
    await monday.getByLabel("Abre (2.º tramo)").fill("");
    await monday.getByLabel("Cierra (2.º tramo)").fill("");
    await monday.getByRole("button", { name: "Guardar" }).click();
    await expect(monday.getByText("Guardado.")).toBeVisible();

    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Luis");
    const url = new URL(page.url());
    url.searchParams.set("dia", nextMonday());
    await page.goto(url.toString());
    const hours = page.getByRole("main").getByRole("region").getByRole("link");
    await expect(hours).toHaveText(["11:00", "11:30"]);
  });

  test("rechaza un horario imposible y tramos que se pisan", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const monday = card(page, "Lunes");
    await monday.getByLabel("Abre", { exact: true }).fill("14:00");
    await monday.getByLabel("Cierra", { exact: true }).fill("10:00");
    await monday.getByRole("button", { name: "Guardar" }).click();
    await expect(monday.getByRole("alert")).toContainText("posterior a la de apertura");

    await monday.getByLabel("Abre", { exact: true }).fill("10:00");
    await monday.getByLabel("Cierra", { exact: true }).fill("16:00");
    await monday.getByRole("button", { name: "Guardar" }).click();
    await expect(monday.getByRole("alert")).toContainText("no pueden pisarse");
  });
});

test.describe("bloqueos", () => {
  const blockDay = async (page: Page, date: string, who?: string) => {
    await page.goto("/panel/horario");
    const form = card(page, "Añadir bloqueo");
    if (who) await form.getByLabel("Quién").selectOption({ label: who });
    await form.getByLabel("Desde").fill(date);
    await form.getByLabel("Hasta").fill(date);
    await form.getByLabel(/Motivo/).fill("Feriado de prueba");
    await form.getByRole("button", { name: "Añadir bloqueo" }).click();
    await expect(form.getByText("Bloqueo añadido.")).toBeVisible();
    return form;
  };

  const hoursOn = async (page: Page, date: string, barber: string) => {
    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, barber);
    const url = new URL(page.url());
    url.searchParams.set("dia", date);
    await page.goto(url.toString());
    await expect(page.getByRole("heading", { name: /Qué día/ })).toBeVisible();
    return page.getByRole("main").getByRole("region").getByRole("link");
  };

  test("bloquear un día quita sus horas y al quitarlo vuelven", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await blockDay(page, date);
    await expect(await hoursOn(page, date, "Luis")).toHaveCount(0);
    await expect(page.getByText(/No quedan horas libres/)).toBeVisible();

    await page.goto("/panel/horario");
    await expect(page.getByRole("list", { name: "Bloqueos vigentes" })).toContainText("Feriado de prueba");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Quitar bloqueo/ }).click();
    await expect(page.getByText("No hay bloqueos vigentes.")).toBeVisible();

    expect(await (await hoursOn(page, date, "Luis")).count()).toBeGreaterThan(0);
  });

  test("el bloqueo de un barbero no afecta al otro", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await blockDay(page, date, "Luis");
    await expect(await hoursOn(page, date, "Luis")).toHaveCount(0);
    expect(await (await hoursOn(page, date, "Barbero invitado")).count()).toBeGreaterThan(0);
  });

  test("solo unas horas: el resto del día sigue libre", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await page.goto("/panel/horario");
    const form = card(page, "Añadir bloqueo");
    await form.getByLabel("Desde").fill(date);
    await form.getByLabel("Hasta").fill(date);
    await form.getByLabel("Solo unas horas").check();
    await form.getByLabel("Hora de inicio").fill("10:00");
    await form.getByLabel("Hora de fin").fill("11:00");
    await form.getByRole("button", { name: "Añadir bloqueo" }).click();
    await expect(form.getByText("Bloqueo añadido.")).toBeVisible();

    const hours = await hoursOn(page, date, "Luis");
    await expect(hours.first()).toHaveText("11:00");
  });

  test("un bloqueo sobre citas ya reservadas avisa y no las cancela", async ({ page }) => {
    await bookUntilData(page);
    const date = new URL(page.url()).searchParams.get("dia") as string;
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

    await login(page);
    const form = await blockDay(page, date);
    await expect(form.getByText(/1 cita ya reservada/)).toBeVisible();
    await page.goto("/panel");
    await expect(page.getByRole("article").first()).toContainText("Por confirmar");
  });

  test("el fin antes del inicio se explica", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const form = card(page, "Añadir bloqueo");
    await form.getByLabel("Desde").fill(nextMonday());
    await form.getByLabel("Hasta").fill(new Date().toISOString().slice(0, 10));
    await form.getByRole("button", { name: "Añadir bloqueo" }).click();
    await expect(form.getByRole("alert")).toContainText("posterior al inicio");
  });
});

test("en el móvil la pestaña actual queda a la vista", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/panel/horario");
  await expect(page.getByRole("navigation", { name: "Secciones del panel" }).getByRole("link", { name: "Horario" })).toBeInViewport({ ratio: 1 });
});

test("las pantallas del panel son accesibles y caben en el móvil", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  for (const path of ["/panel/servicios", "/panel/productos", "/panel/barberos", "/panel/horario", "/panel/web"]) {
    await page.goto(path);
    await page.getByRole("form").first().waitFor();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
    expect(serious, path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test.describe("web", () => {
  test("el contacto guardado aparece en la portada y lo vacío desaparece", async ({ page }) => {
    await login(page);
    await page.goto("/panel/web");
    const form = card(page, "Contacto");
    await form.getByLabel("WhatsApp").fill("900 111 222");
    await form.getByLabel("Instagram").fill("https://instagram.com/ejemplo");
    await form.getByLabel("Dirección").fill("Av. Ejemplo 123");
    await form.getByRole("button", { name: "Guardar contacto" }).click();
    await expect(form.getByText("Guardado. Ya se ve en la web.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Escríbenos por WhatsApp" }).first()).toHaveAttribute("href", /wa\.me\/51900111222/);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/ejemplo");
    await expect(page.getByText("Av. Ejemplo 123").first()).toBeVisible();

    await page.goto("/panel/web");
    await card(page, "Contacto").getByLabel("Instagram").fill("");
    await card(page, "Contacto").getByRole("button", { name: "Guardar contacto" }).click();
    await expect(card(page, "Contacto").getByText("Guardado. Ya se ve en la web.")).toBeVisible();
    await page.goto("/");
    await page.getByRole("contentinfo").waitFor();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Instagram" })).toHaveCount(0);
  });

  test("un enlace javascript: no se guarda ni llega a la web", async ({ page }) => {
    await login(page);
    await page.goto("/panel/web");
    const form = card(page, "Contacto");
    await form.getByLabel("Enlace de Google Maps").fill("javascript:alert(document.cookie)");
    await form.getByRole("button", { name: "Guardar contacto" }).click();
    await expect(form.getByRole("alert")).toContainText("https://");

    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  });

  test("ocultar secciones las quita de la portada y del menú", async ({ page }, info) => {
    await login(page);
    await page.goto("/panel/web");
    const form = card(page, "Secciones visibles");
    await form.getByLabel("Productos para llevar").uncheck();
    await form.getByLabel("Nosotros").uncheck();
    await form.getByRole("button", { name: "Guardar secciones" }).click();
    await expect(form.getByText("Guardado. Ya se ve en la web.")).toBeVisible();

    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.getByRole("heading", { name: "Para llevar a casa" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Oficio de barbería/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Horario", level: 2 })).toBeVisible();
    if (info.project.name === "escritorio") {
      const menu = page.getByRole("navigation", { name: "Principal" });
      await expect(menu.getByRole("link", { name: "Productos" })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "Horario" })).toBeVisible();
    }
  });
});
