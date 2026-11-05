import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { resetBookings } from "./database";
import { bookUntilData, chooseBarber, chooseDay, chooseServices } from "./helpers";

test.beforeEach(() => resetBookings());

async function expectNoSeriousA11yIssues(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious, where).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, where).toBeLessThanOrEqual(0);
}

test.describe("portada", () => {
  test("muestra todas sus secciones con datos reales de la base", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Luis");
    for (const name of ["Servicios", "Por qué venir", "Cómo reservar", "Para llevar a casa", "Horario"]) {
      await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Reservar este servicio/ })).toHaveCount(4);
    await expect(page.getByText("Lunes a sábado")).toBeVisible();
    // Sin opiniones reales, la sección de testimonios no aparece.
    await expect(page.getByRole("heading", { name: "Lo que dicen" })).toHaveCount(0);
  });

  test("el botón principal lleva a la reserva", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Reservar cita" }).first().click();
    await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();
  });

  test("el menú lleva a su sección, también desde la reserva", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "En móvil el menú de anclas no se muestra.");
    await page.goto("/reservar");
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Horario" }).click();
    await expect(page).toHaveURL(/#horario$/);
    await expect(page.getByRole("heading", { name: "Horario" })).toBeInViewport();
  });

  test("todas las imágenes cargan", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForLoadState("networkidle");
    const broken = await page.locator("img").evaluateAll((imgs) =>
      imgs.filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0).map((i) => (i as HTMLImageElement).src),
    );
    expect(broken).toEqual([]);
  });
});

test.describe("adaptable", () => {
  for (const width of [375, 768, 1024, 1440]) {
    test(`sin scroll horizontal a ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByRole("heading", { name: "Servicios" }).waitFor();
      await expectNoHorizontalScroll(page, "portada");

      await page.goto("/reservar");
      await page.getByRole("heading", { name: /Qué servicio/ }).waitFor();
      await expectNoHorizontalScroll(page, "paso 1");
      await chooseServices(page, [/Corte clásico/]);
      await expectNoHorizontalScroll(page, "paso 2");
      await chooseBarber(page, "Luis");
      await expectNoHorizontalScroll(page, "paso 3");
      await chooseDay(page);
      await page.getByRole("region", { name: "Mañana" }).getByRole("link").first().click();
      await page.getByRole("heading", { name: "Tus datos" }).waitFor();
      await expectNoHorizontalScroll(page, "paso 4");
    });
  }

  test("las zonas táctiles de la reserva miden al menos 44 px", async ({ page }, info) => {
    test.skip(info.project.name !== "movil", "Solo aplica al móvil.");
    await bookUntilData(page);
    const small = await page
      .getByRole("main")
      .locator("a, button, input:not([type=hidden])")
      .evaluateAll((els) =>
        els
          .filter((e) => e.getBoundingClientRect().height < 44)
          .map((e) => e.outerHTML.slice(0, 80)),
      );
    expect(small).toEqual([]);
  });
});

test.describe("accesibilidad", () => {
  test("axe sin fallos graves en la portada y en cada paso", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Servicios" }).waitFor();
    await expectNoSeriousA11yIssues(page, "portada");

    await page.goto("/reservar");
    await page.getByRole("heading", { name: /Qué servicio/ }).waitFor();
    await expectNoSeriousA11yIssues(page, "paso 1");

    await chooseServices(page, [/Corte clásico/]);
    await expectNoSeriousA11yIssues(page, "paso 2");

    await chooseBarber(page, "Luis");
    await expectNoSeriousA11yIssues(page, "paso 3");

    await chooseDay(page);
    await page.getByRole("region", { name: "Mañana" }).getByRole("link").first().click();
    await page.getByRole("heading", { name: "Tus datos" }).waitFor();
    await expectNoSeriousA11yIssues(page, "paso 4");

    await page.getByLabel("Nombre").fill("Cliente Prueba");
    await page.getByLabel(/Celular/).fill("900000123");
    await page.getByRole("button", { name: "Reservar cita" }).click();
    await page.getByRole("heading", { name: "Reserva registrada" }).waitFor();
    await expectNoSeriousA11yIssues(page, "confirmación");
  });

  test("al cambiar de paso, el foco va al título", async ({ page }) => {
    await chooseServices(page, [/Corte clásico/]);
    await expect(page.getByRole("heading", { name: "¿Con quién?" })).toBeFocused();
    await chooseBarber(page, "Luis");
    await expect(page.getByRole("heading", { name: /Qué día/ })).toBeFocused();
  });

  test("se puede reservar solo con el teclado", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByLabel(/Corte clásico/).focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Continuar" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "¿Con quién?" })).toBeFocused();

    await page.getByRole("main").getByRole("link", { name: "Luis" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /Qué día/ })).toBeFocused();

    await page.getByRole("region", { name: "Tarde" }).getByRole("link").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeFocused();

    await page.keyboard.press("Tab"); // Nombre, tras el título
    await expect(page.getByLabel("Nombre")).toBeFocused();
  });

  test("con movimiento reducido el poste de barbero no se anima", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("http://localhost:3100/");
    const animation = await page.locator(".barber-pole").evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
    await context.close();
  });
});
