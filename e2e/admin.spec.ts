import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { PANEL_PASSWORD, resetCatalog } from "./database";
import { bookUntilData, chooseBarber, chooseServices, fillData, openFirstPending, pendingCards } from "./helpers";

test.beforeEach(() => resetCatalog());
test.afterAll(() => resetCatalog());

async function login(page: Page) {
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
}

const card = (page: Page, name: string) => page.getByRole("form", { name });
const tile = (page: Page, name: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
/** Los servicios se editan en un diálogo: "Editar" en su tarjeta, y el formulario lleva el nombre del servicio. */
async function editService(page: Page, name: string) {
  await tile(page, name).getByRole("button", { name: "Editar" }).click();
  return card(page, name);
}

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
    await page.getByRole("button", { name: "Nuevo servicio" }).click();
    const form = card(page, "Añadir servicio");
    await form.getByLabel("Nombre").fill("Tinte de barba");
    await form.getByLabel("Duración (minutos)").fill("20");
    await form.getByLabel("Precio (S/)").fill("25.50");
    await form.getByRole("button", { name: "Añadir" }).click();

    await expect(form.getByText("Guardado.")).toBeVisible();
    await expect(tile(page, "Tinte de barba")).toContainText("20 min");
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
    const form = await editService(page, "Corte clásico");
    await form.getByLabel("Precio (S/)").fill("99");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Corte clásico/ })).toContainText("S/ 99.00");
    await page.goto("/panel");
    await expect(await openFirstPending(page)).toContainText("S/ 30.00");
  });

  test("ocultar un servicio lo quita de la web sin perderlo en el panel", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = await editService(page, "Fade");
    await form.getByLabel("Visible en la web").uncheck();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();

    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.getByRole("link", { name: /Fade/ })).toHaveCount(0);
    await page.goto("/panel/servicios");
    await expect((await editService(page, "Fade")).getByLabel("Visible en la web")).not.toBeChecked();
    await expect(tile(page, "Fade").getByRole("switch")).not.toBeChecked();
  });

  test("el área de un servicio se cambia y se conserva, y sin precio no se muestra", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = await editService(page, "Manicure de prueba");
    await expect(form.getByLabel("Área")).toHaveValue("spa");
    await form.getByLabel("Área").selectOption({ label: "Barbería" });
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();
    await page.reload();
    await expect((await editService(page, "Manicure de prueba")).getByLabel("Área")).toHaveValue("barberia");

    await card(page, "Manicure de prueba").getByLabel("Precio (S/)").fill("0");
    await card(page, "Manicure de prueba").getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Manicure de prueba").getByRole("alert")).toContainText("Pon un precio");
  });

  test("un dato inválido se explica y no borra lo escrito", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = await editService(page, "Corte clásico");
    await form.getByLabel("Precio (S/)").fill("gratis");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByRole("alert")).toContainText("precio en soles");
    await expect(form.getByLabel("Precio (S/)")).toHaveValue("gratis");

    await form.getByLabel("Precio (S/)").fill("30");
    await form.getByLabel("Duración (minutos)").fill("32");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByRole("alert")).toContainText("de 5 en 5");
  });

  test("el interruptor oculta y vuelve a mostrar un servicio al momento", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const fade = tile(page, "Fade").getByRole("switch");
    await expect(fade).toBeChecked();
    await fade.uncheck();
    await expect(tile(page, "Fade").getByText("Oculto")).toBeVisible();
    await expect(fade).not.toBeChecked();
    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expect(page.getByRole("link", { name: /Fade/ })).toHaveCount(0);

    await page.goto("/panel/servicios");
    await tile(page, "Fade").getByRole("switch").check();
    await expect(tile(page, "Fade").getByText("Visible")).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Fade/ })).toBeVisible();
  });

  test("mostrar un servicio sin precio falla y el interruptor vuelve a Oculto", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const form = await editService(page, "Manicure de prueba");
    await form.getByLabel("Precio (S/)").fill("0");
    await form.getByLabel("Visible en la web").uncheck();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();
    await form.getByRole("button", { name: "Cancelar" }).click();

    const sw = tile(page, "Manicure de prueba").getByRole("switch");
    await expect(sw).not.toBeChecked();
    await sw.click(); // check() exige que el estado cambie y aquí vuelve atrás
    await expect(tile(page, "Manicure de prueba").getByRole("alert")).toContainText("Pon un precio");
    await expect(sw).not.toBeChecked();
  });

  test("el filtro por área muestra solo Barbería o solo Spa y estilista", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    await expect(page.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Spa y estilista" }).click();
    await expect(page.getByRole("button", { name: "Spa y estilista" })).toHaveAttribute("aria-pressed", "true");
    await expect(tile(page, "Manicure de prueba")).toHaveCount(1);
    await expect(tile(page, "Corte clásico")).toHaveCount(0);
    await page.getByRole("button", { name: "Barbería", exact: true }).click();
    await expect(tile(page, "Manicure de prueba")).toHaveCount(0);
    await expect(tile(page, "Corte clásico")).toHaveCount(1);
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await expect(tile(page, "Manicure de prueba")).toHaveCount(1);
    await expect(tile(page, "Corte clásico")).toHaveCount(1);
  });

  test("Esc cierra el diálogo y el foco vuelve al botón Editar", async ({ page }) => {
    await login(page);
    await page.goto("/panel/servicios");
    const edit = tile(page, "Fade").getByRole("button", { name: "Editar" });
    await edit.click();
    await expect(card(page, "Fade")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page, "Fade")).toHaveCount(0);
    await expect(edit).toBeFocused();
  });

  test("/panel/servicios a 320 px no desborda y es accesible", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    await page.goto("/panel/servicios");
    await page.getByRole("article").first().waitFor();
    for (const open of [false, true]) {
      if (open) await page.getByRole("button", { name: "Nuevo servicio" }).click();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    }
  });
});

test("un producto oculto deja de ofrecerse al reservar", async ({ page }) => {
  await login(page);
  await page.goto("/panel/productos");
  await tile(page, "Cera mate").getByRole("switch", { name: /Visible: Cera mate/ }).uncheck();
  await expect(tile(page, "Cera mate").getByRole("switch", { name: /Oculto: Cera mate/ })).not.toBeChecked();
  await page.reload();
  const form = await editService(page, "Cera mate");
  await expect(form.getByLabel("Visible en la web")).not.toBeChecked();

  await bookUntilData(page);
  await expect(page.getByRole("button", { name: "Añadir Cera mate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Añadir Aceite para barba" })).toBeVisible();
});

test("/panel/productos a 320 px no desborda y es accesible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await login(page);
  await page.goto("/panel/productos");
  await page.getByRole("article").first().waitFor();
  for (const open of [false, true]) {
    if (open) await page.getByRole("button", { name: "Nuevo producto" }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});

test.describe("barberos", () => {
  test("el dueño aparece sin formulario y otro barbero se puede renombrar", async ({ page }) => {
    await login(page);
    await page.goto("/panel/barberos");
    await expect(page.getByText("Luis · Dueño")).toBeVisible();
    await expect(card(page, "Luis")).toHaveCount(0);
    await expect(tile(page, "Luis").getByRole("switch")).toHaveCount(0);
    await expect(tile(page, "Luis").getByRole("button", { name: "Editar" })).toHaveCount(0);
    await expect(tile(page, "Luis").getByText("Perfil principal siempre activo")).toBeVisible();
    const form = await editService(page, "Barbero invitado");
    await form.getByLabel("Nombre").fill("Barbero renombrado");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Barbero renombrado")).toBeVisible();
  });

  test("las áreas de un profesional se cambian, y siempre queda una", async ({ page }) => {
    await login(page);
    await page.goto("/panel/barberos");
    const form = await editService(page, "Estilista invitada");
    const spa = form.getByRole("group", { name: "Áreas" }).getByLabel("Spa y estilista");
    await expect(spa).toBeChecked();
    await form.getByLabel("Barbería", { exact: true }).check();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();
    await expect(form.getByLabel("Barbería", { exact: true })).toBeChecked();

    await page.reload();
    await editService(page, "Estilista invitada");
    await expect(card(page, "Estilista invitada").getByLabel("Barbería", { exact: true })).toBeChecked();
    await card(page, "Estilista invitada").getByLabel("Barbería", { exact: true }).uncheck();
    await card(page, "Estilista invitada").getByLabel("Spa y estilista").uncheck();
    await card(page, "Estilista invitada").getByRole("button", { name: "Guardar" }).click();
    await expect(card(page, "Estilista invitada").getByRole("alert")).toContainText("al menos un área");
    await expect(page.getByText("Luis · Dueño · Barbería")).toBeVisible();
  });

  test("/panel/barberos a 320 px no desborda y es accesible", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    await page.goto("/panel/barberos");
    await page.getByRole("article").first().waitFor();
    for (const open of [false, true]) {
      if (open) await page.getByRole("button", { name: "Nuevo profesional" }).click();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    }
  });

  test("un barbero nuevo se puede elegir al reservar", async ({ page }) => {
    await login(page);
    await page.goto("/panel/barberos");
    await page.getByRole("button", { name: "Nuevo profesional" }).click();
    const form = card(page, "Añadir barbero");
    await form.getByLabel("Nombre").fill("Barbero Nuevo");
    await form.getByRole("button", { name: "Añadir" }).click();
    await expect(tile(page, "Barbero Nuevo")).toBeVisible();

    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Barbero Nuevo");
  });

  test("ocultar a un barbero con citas avisa, y deja de ofrecerse", async ({ page }) => {
    await bookUntilData(page, "Barbero invitado");
    await fillData(page);
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();

    await login(page);
    await page.goto("/panel/barberos");
    const guest = tile(page, "Barbero invitado");
    await guest.getByRole("switch").uncheck();
    await expect(guest.getByText(/1 cita por venir/)).toBeVisible();
    // Regresión: el reinicio automático del formulario devolvía el interruptor a "activo".
    await expect(guest.getByText("Inactivo")).toBeVisible();
    await expect(guest.getByRole("switch")).not.toBeChecked();
    await page.reload();
    await expect(tile(page, "Barbero invitado").getByRole("switch")).not.toBeChecked();

    await chooseServices(page, [/Corte clásico/]);
    await expect(page.getByRole("main").getByRole("link", { name: "Barbero invitado", exact: true })).toHaveCount(0);
  });
});

/** Un solo botón guarda los días que cambiaron. */
const saveHours = (page: Page) => page.getByRole("button", { name: "Guardar horario" }).click();

test.describe("horario", () => {
  test("cerrar un día lo marca cerrado en la reserva y en la web", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const monday = card(page, "Lunes");
    await monday.getByRole("switch").uncheck();
    await expect(monday.getByLabel("Abre", { exact: true })).toBeDisabled();
    await saveHours(page);
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
    await saveHours(page);
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
    await saveHours(page);
    await expect(monday.getByRole("alert")).toContainText("posterior a la de apertura");

    await monday.getByLabel("Abre", { exact: true }).fill("10:00");
    await monday.getByLabel("Cierra", { exact: true }).fill("16:00");
    await saveHours(page);
    await expect(monday.getByRole("alert")).toContainText("no pueden pisarse");
  });

  test("un solo botón guarda dos días a la vez, con almuerzo", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    const monday = card(page, "Lunes");
    await monday.getByLabel("Abre", { exact: true }).fill("10:00");
    await monday.getByLabel("Cierra", { exact: true }).fill("14:00");
    await monday.getByLabel("Abre (2.º tramo)").fill("16:00");
    await monday.getByLabel("Cierra (2.º tramo)").fill("18:00");
    await card(page, "Martes").getByRole("switch").uncheck();
    await saveHours(page);
    await expect(monday.getByText("Guardado.")).toBeVisible();
    await expect(card(page, "Martes").getByText("Guardado.")).toBeVisible();
    // Un día sin cambios no se envía.
    await expect(card(page, "Miércoles").getByText("Guardado.")).toHaveCount(0);

    await page.reload();
    await expect(card(page, "Martes").getByRole("switch")).not.toBeChecked();
    await expect(card(page, "Lunes").getByLabel("Abre (2.º tramo)")).toHaveValue("16:00");

    await chooseServices(page, [/Corte clásico/]);
    await chooseBarber(page, "Luis");
    const url = new URL(page.url());
    url.searchParams.set("dia", nextMonday());
    await page.goto(url.toString());
    const hours = page.getByRole("main").getByRole("region").getByRole("link");
    await expect(hours.first()).toHaveText("10:00");
    await expect(hours.filter({ hasText: "14:00" })).toHaveCount(0);
    await expect(hours.filter({ hasText: "16:00" })).toHaveCount(1);
  });
});

test.describe("bloqueos", () => {
  const blockDay = async (page: Page, date: string, who?: string) => {
    await page.goto("/panel/horario");
    await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
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

  test("con el barbero lleno se ofrece otro barbero y el siguiente día", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await blockDay(page, date, "Luis");
    await expect(await hoursOn(page, date, "Luis")).toHaveCount(0);
    await expect(page.getByText("No quedan horas libres ese día con Luis")).toBeVisible();
    await expect(page.getByText("Ese día pueden atenderte:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver el siguiente día/ })).toBeVisible();
    await page.getByRole("link", { name: /Barbero invitado · \d+ horas? libres?/ }).click();
    await expect(page.getByRole("main").getByRole("region").getByRole("link").first()).toBeVisible();
  });

  test("solo unas horas: el resto del día sigue libre", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await page.goto("/panel/horario");
    await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
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
    await expect(pendingCards(page)).toHaveCount(1);
    await expect(await openFirstPending(page)).toContainText("Por confirmar");
  });

  test("el fin antes del inicio se explica", async ({ page }) => {
    await login(page);
    await page.goto("/panel/horario");
    await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
    const form = card(page, "Añadir bloqueo");
    await form.getByLabel("Desde").fill(nextMonday());
    await form.getByLabel("Hasta").fill(new Date().toISOString().slice(0, 10));
    await form.getByRole("button", { name: "Añadir bloqueo" }).click();
    await expect(form.getByRole("alert")).toContainText("posterior al inicio");
  });

  test("Revisar en agenda lleva al día del bloqueo", async ({ page }) => {
    const date = nextMonday();
    await login(page);
    await blockDay(page, date);
    await page.keyboard.press("Escape");
    await page.getByRole("list", { name: "Bloqueos vigentes" }).getByRole("link", { name: "Revisar en agenda" }).click();
    await expect(page).toHaveURL(new RegExp(`/panel\\?vista=dia&dia=${date}`));
    await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
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
    await page.getByRole(path === "/panel/servicios" || path === "/panel/productos" || path === "/panel/barberos" ? "article" : "form").first().waitFor();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
    expect(serious, path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test("horario a 320x640 no desborda y es accesible, con y sin diálogo", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await login(page);
  await page.goto("/panel/horario");
  await card(page, "Lunes").waitFor();
  const check = async (label: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), label).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), label).toBeLessThanOrEqual(0);
  };
  await check("sin diálogo");
  await page.getByRole("button", { name: "Nuevo bloqueo" }).click();
  await card(page, "Añadir bloqueo").waitFor();
  await check("con diálogo");
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
