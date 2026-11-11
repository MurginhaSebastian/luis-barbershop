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

test.describe("video de la portada", () => {
  test("arranca solo y sin sonido, es decorativo y se puede pausar", async ({ page }, info) => {
    await page.goto("/");
    const pause = page.getByRole("button", { name: "Pausar el video" });
    await expect(pause).toBeVisible();
    const video = page.locator("video");
    const state = await video.evaluate((v: HTMLVideoElement) => ({
      muted: v.muted,
      paused: v.paused,
      src: v.currentSrc,
      hidden: v.getAttribute("aria-hidden"),
      tab: v.tabIndex,
    }));
    expect(state).toMatchObject({ muted: true, paused: false, hidden: "true", tab: -1 });
    // El móvil en vertical recibe el clip vertical, que además pesa menos.
    expect(state.src).toMatch(info.project.name === "movil" ? /corte-movil\.mp4$/ : /corte-escritorio\.mp4$/);
    // Aparece sobre el póster solo cuando ya se mueve.
    await expect(video).toHaveCSS("opacity", "1");

    await pause.click();
    await expect(page.getByRole("button", { name: "Reproducir el video" })).toBeVisible();
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });

  test("con ahorro de datos no descarga el video", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } }));
    const videos: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/videos/") && r.url().endsWith(".mp4")) videos.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Reproducir el video" })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(videos).toEqual([]);
    // El póster sí está, para que la portada no quede vacía.
    expect(await page.locator("section").first().locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  });
});

test("una dirección que no existe muestra la página 404 de la marca", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: /Qué servicio/ })).toBeVisible();
});

test("las cabeceras de seguridad están y no rompen nada", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));

  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();

  await page.getByRole("heading", { name: "Servicios" }).waitFor();
  await bookUntilData(page);
  await page.getByLabel("Nombre").fill("Cliente Prueba");
  await page.getByLabel(/Celular/).fill("900000456");
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await page.getByRole("heading", { name: "Reserva registrada" }).waitFor();
  expect(problems).toEqual([]);
});

test("el panel se puede instalar y su service worker no queda en caché", async ({ request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(sw.headers()["content-security-policy"]).toBe("default-src 'self'; script-src 'self'");

  expect(await (await request.get("/panel/entrar")).text()).toContain('rel="manifest" href="/panel.webmanifest"');
  const manifest = await (await request.get("/panel.webmanifest")).json();
  expect(manifest).toMatchObject({ start_url: "/panel", scope: "/panel", display: "standalone" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  // La web pública no se ofrece como app del panel.
  expect(await (await request.get("/")).text()).not.toContain('rel="manifest"');
});

test("el video se guarda en caché y se sirve por partes, como pide Safari", async ({ request }) => {
  for (const file of ["/videos/corte-escritorio.mp4", "/videos/corte-movil.mp4"]) {
    const whole = await request.get(file);
    expect(whole.headers()["content-type"]).toBe("video/mp4");
    expect(whole.headers()["cache-control"]).toContain("max-age=604800");
    const part = await request.get(file, { headers: { Range: "bytes=0-99" } });
    expect(part.status()).toBe(206);
    expect((await part.body()).length).toBe(100);
  }
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
    // El paso llega en streaming y está oculto un instante: focus() no espera a que se vea.
    const service = page.getByLabel(/Corte clásico/);
    await service.waitFor();
    await service.focus();
    await page.keyboard.press("Space");
    // Sin JavaScript aún, "Continuar" sigue desactivado: un usuario real espera a que se active.
    await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
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

  test("con movimiento reducido el video de la portada no arranca solo", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ reducedMotion: "reduce", baseURL: testInfo.project.use.baseURL });
    const page = await context.newPage();
    await page.goto("/");
    const play = page.getByRole("button", { name: "Reproducir el video" });
    await expect(play).toBeVisible();
    await page.waitForTimeout(1000);
    expect(await page.locator("video").evaluate((v: HTMLVideoElement) => v.paused && v.readyState === 0)).toBe(true);
    // Quien quiera verlo, lo pide.
    await play.click();
    await expect(page.getByRole("button", { name: "Pausar el video" })).toBeVisible();
    await context.close();
  });
});
