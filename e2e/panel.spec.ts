import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { PANEL_PASSWORD, resetBookings, withE2eDatabase } from "./database";
import { bookUntilData, fillData } from "./helpers";

test.beforeEach(async ({ context }) => {
  await resetBookings();
  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp simulado" }));
});

async function login(page: Page) {
  await page.goto("/panel/entrar");
  await page.getByLabel("Clave").fill(PANEL_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
}

async function bookAppointment(page: Page) {
  await bookUntilData(page);
  await fillData(page);
  await page.getByRole("button", { name: "Reservar cita" }).click();
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
}

const statuses = () =>
  withE2eDatabase(async (db) => (await db.query("SELECT status FROM appointments")).rows.map((r) => r.status));

/** Acción que abre WhatsApp en otra pestaña: devuelve el mensaje que llevaba. */
async function whatsappMessage(context: BrowserContext, click: () => Promise<void>) {
  const [popup] = await Promise.all([context.waitForEvent("page"), click()]);
  const text = new URL(popup.url()).searchParams.get("text");
  await popup.close();
  return text;
}

test.describe("acceso", () => {
  test("sin sesión no se ve la agenda", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel\/entrar$/);
    await expect(page.getByRole("heading", { name: "Por confirmar" })).toHaveCount(0);
  });

  test("la clave equivocada no entra y la correcta sí; cerrar sesión cierra de verdad", async ({ page }) => {
    await page.goto("/panel/entrar");
    await page.getByLabel("Clave").fill("clave-equivocada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("La clave no es correcta.")).toBeVisible();

    await login(page);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/panel\/entrar$/);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel\/entrar$/);
  });

  test("una cookie inventada no da acceso", async ({ page, context }) => {
    const expires = String(Date.now() + 3_600_000);
    await context.addCookies([
      { name: "panel_session", value: `${expires}.${"a".repeat(64)}`, url: "http://localhost:3100/panel" },
    ]);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel\/entrar$/);
  });

  test("la sesión va en una cookie que el JavaScript de la página no puede leer", async ({ page, context }) => {
    await login(page);
    const cookie = (await context.cookies()).find((c) => c.name === "panel_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("panel_session");
  });

  test("tras 5 intentos fallidos se bloquea, aunque luego se acierte", async ({ browser }) => {
    // Un origen distinto por proyecto: el freno vive en el servidor y dura entre pruebas.
    const origin = `203.0.113.${test.info().project.name === "movil" ? 7 : 8}`;
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": origin } });
    const page = await context.newPage();
    await page.goto("http://localhost:3100/panel/entrar");
    // Espera la respuesta de cada envío: React vacía el campo al terminar y borraría el siguiente intento.
    const attempt = async (password: string) => {
      await page.getByLabel("Clave").fill(password);
      const answered = page.waitForResponse((r) => r.request().method() === "POST");
      await page.getByRole("button", { name: "Entrar" }).click();
      await answered;
      await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
    };
    for (let i = 0; i < 5; i++) await attempt(`mala-${i}`);
    await attempt(PANEL_PASSWORD);
    await expect(page.getByText("Demasiados intentos")).toBeVisible();
    await page.goto("http://localhost:3100/panel");
    await expect(page).toHaveURL(/\/panel\/entrar$/);
    await context.close();
  });

  test("si la sesión caduca, las acciones no hacen nada", async ({ page, context }) => {
    await bookAppointment(page);
    await login(page);
    await context.clearCookies();
    await page.getByRole("button", { name: "Confirmar sin avisar" }).first().click();
    await expect(page).toHaveURL(/\/panel\/entrar$/);
    expect(await statuses()).toEqual(["PENDING"]);
  });

  test("el panel no se indexa en buscadores", async ({ page }) => {
    await page.goto("/panel/entrar");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("agenda", () => {
  test("una reserva nueva aparece por confirmar con sus datos", async ({ page }) => {
    await bookAppointment(page);
    await login(page);
    const card = page.getByRole("region", { name: /Por confirmar/ }).getByRole("article");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Cliente Prueba");
    await expect(card).toContainText("Corte clásico con Luis");
    await expect(card).toContainText("S/ 30.00");
  });

  test("confirmar abre WhatsApp con el mensaje y saca la cita de pendientes", async ({ page, context }) => {
    await bookAppointment(page);
    await login(page);
    const message = await whatsappMessage(context, () =>
      page.getByRole("button", { name: "Confirmar y avisar" }).click(),
    );
    expect(message).toMatch(/^Hola Cliente Prueba, tu cita en Luis Barbershop está confirmada: .+ con Luis/);
    await expect(page.getByText("Todas las citas están respondidas.")).toBeVisible();
    expect(await statuses()).toEqual(["CONFIRMED"]);
  });

  test("cancelar pide confirmación, avisa y libera la hora", async ({ page, context }) => {
    await bookAppointment(page);
    await login(page);

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    expect(await statuses()).toEqual(["PENDING"]);

    page.once("dialog", (dialog) => dialog.accept());
    const message = await whatsappMessage(context, () => page.getByRole("button", { name: "Cancelar" }).first().click());
    expect(message).toContain("tuvimos que cancelar");
    await expect(page.getByText("Todas las citas están respondidas.")).toBeVisible();
    expect(await statuses()).toEqual(["CANCELLED"]);

    // Esa misma hora vuelve a estar libre para otro cliente.
    await bookAppointment(page);
    expect((await statuses()).sort()).toEqual(["CANCELLED", "PENDING"]);
  });

  test("una cita del día se marca como atendida y deja de tener acciones", async ({ page }) => {
    await bookAppointment(page);
    await login(page);
    await page.getByRole("button", { name: "Confirmar sin avisar" }).click();
    await expect(page.getByText("Todas las citas están respondidas.")).toBeVisible();

    const day = await withE2eDatabase(async (db) => {
      const { rows } = await db.query(
        "SELECT to_char(starts_at AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS day FROM appointments",
      );
      return rows[0].day as string;
    });
    await page.goto(`/panel?dia=${day}`);
    const card = page.getByRole("region", { name: /^(Hoy|.*de .*)$/ }).getByRole("article");
    await card.getByRole("button", { name: "Atendida" }).click();
    await expect(card).toContainText("Atendida");
    await expect(card.getByRole("button")).toHaveCount(0);
    expect(await statuses()).toEqual(["COMPLETED"]);
  });

  test("se puede cambiar de día y volver a hoy; una fecha inválida muestra hoy", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
    await page.getByRole("link", { name: "Día siguiente" }).click();
    await expect(page.getByRole("heading", { name: "Hoy" })).toHaveCount(0);
    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();

    await page.goto("/panel?dia=basura");
    await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  });

  test("las reservas nuevas aparecen solas, sin recargar", async ({ page, browser }) => {
    await page.clock.install();
    await login(page);
    await expect(page.getByText("Todas las citas están respondidas.")).toBeVisible();

    const client = await browser.newPage({ baseURL: "http://localhost:3100" });
    await bookAppointment(client);
    await client.close();

    await page.clock.fastForward(61_000);
    await expect(page.getByRole("region", { name: /Por confirmar/ }).getByRole("article")).toHaveCount(1);
  });

  test("es accesible y cabe en la pantalla", async ({ page }) => {
    await page.goto("/panel/entrar");
    const check = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
      expect(serious, where).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), where).toBeLessThanOrEqual(0);
    };
    await check("entrada");
    await bookAppointment(page);
    await login(page);
    await check("agenda");
  });
});

test.describe("avisos push", () => {
  /** El navegador de pruebas no tiene servicio de push: se simula su suscripción, con claves reales. */
  async function fakePushService(page: Page) {
    await page.addInitScript(() => {
      const w = window as unknown as { fakeSub: PushSubscription | null };
      w.fakeSub = null;
      const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      PushManager.prototype.subscribe = async function () {
        const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
        const json = {
          endpoint: "https://push.e2e.invalid/dispositivo",
          expirationTime: null,
          keys: {
            p256dh: b64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
            auth: b64(crypto.getRandomValues(new Uint8Array(16))),
          },
        };
        w.fakeSub = {
          endpoint: json.endpoint,
          toJSON: () => json,
          unsubscribe: async () => ((w.fakeSub = null), true),
        } as unknown as PushSubscription;
        return w.fakeSub;
      };
      PushManager.prototype.getSubscription = async () => w.fakeSub;
    });
  }

  const devices = () =>
    withE2eDatabase(async (db) => (await db.query("SELECT endpoint FROM push_subscriptions")).rows.map((r) => r.endpoint));

  test.beforeEach(() => withE2eDatabase((db) => db.query("TRUNCATE push_subscriptions")));

  test("se activan, se prueban y se desactivan en este dispositivo", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await fakePushService(page);
    await login(page);
    const box = page.getByRole("region", { name: "Avisos en este dispositivo" });

    await box.getByRole("button", { name: "Activar avisos" }).click();
    await expect(box).toContainText("Avisos activados en este dispositivo");
    expect(await devices()).toEqual(["https://push.e2e.invalid/dispositivo"]);

    // El servicio de push no existe: el aviso no llega y el panel lo dice.
    await box.getByRole("button", { name: "Enviar prueba" }).click();
    await expect(box.getByRole("alert")).toContainText("No llegó a ningún dispositivo");
    expect(await devices()).toHaveLength(1);

    await box.getByRole("button", { name: "Desactivar" }).click();
    await expect(box.getByRole("button", { name: "Activar avisos" })).toBeVisible();
    expect(await devices()).toEqual([]);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("la reserva se registra aunque el aviso no pueda entregarse", async ({ page }) => {
    await withE2eDatabase((db) =>
      db.query("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)", [
        "https://push.e2e.invalid/roto",
        "B".repeat(87),
        "a".repeat(22),
      ]),
    );
    await bookAppointment(page);
    expect(await statuses()).toEqual(["PENDING"]);
  });

  test("al llegar un aviso, la agenda abierta muestra la reserva sin esperar", async ({ page, context, browser }, testInfo) => {
    await context.grantPermissions(["notifications"]);
    const cdp = await context.newCDPSession(page);
    const registrationId = new Promise<string>((resolve) =>
      cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
        const panel = registrations.find((r) => r.scopeURL.endsWith("/panel") && !r.isDeleted);
        if (panel) resolve(panel.registrationId);
      }),
    );
    await cdp.send("ServiceWorker.enable");
    await login(page);
    await expect(page.getByRole("region", { name: "Avisos en este dispositivo" })).toContainText("Activar avisos");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Un cliente reserva desde otro navegador.
    const customer = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    await bookAppointment(await customer.newPage());
    await customer.close();
    await expect(page.getByText("Cliente Prueba")).toHaveCount(0);

    const origin = new URL(page.url()).origin;
    const data = JSON.stringify({ title: "Nueva reserva", body: "Cliente Prueba", url: "/panel" });
    await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: await registrationId, data });
    // Mucho antes del minuto del refresco automático.
    await expect(page.getByText("Cliente Prueba").first()).toBeVisible({ timeout: 10_000 });
  });

  test("con los avisos bloqueados explica cómo permitirlos", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
    await login(page);
    await expect(page.getByRole("region", { name: "Avisos en este dispositivo" })).toContainText("Bloqueaste los avisos");
  });
});
