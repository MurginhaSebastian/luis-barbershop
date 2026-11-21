import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { PANEL_PASSWORD, resetBookings, seedAgendaDay as seedDay, withE2eDatabase } from "./database";

const todayTitle = () =>
  new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "numeric", month: "long", year: "numeric" });
import { bookUntilData, fillData, openFirstPending, pendingCards, pendingList } from "./helpers";

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
    const card = await openFirstPending(page);
    await context.clearCookies();
    await card.getByRole("button", { name: "Confirmar cita" }).click();
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
    await expect(pendingCards(page)).toHaveCount(1);
    const card = await openFirstPending(page);
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Cliente Prueba");
    await expect(card).toContainText("Corte clásico con Luis");
    await expect(card).toContainText("S/ 30.00");
  });

  test("confirmar cambia el estado sin abrir WhatsApp; enviar WhatsApp lleva al chat", async ({ page, context }) => {
    await bookAppointment(page);
    await login(page);
    const card = await openFirstPending(page);
    const link = card.getByRole("link", { name: "Enviar WhatsApp" });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent((await link.getAttribute("href")) ?? "")).toMatch(/^.+text=Hola Cliente Prueba, te escribo de Luis Barbershop por tu cita/);
    let opened = false;
    context.on("page", () => (opened = true));
    await card.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(pendingCards(page)).toHaveCount(0);
    expect(opened).toBe(false);
    expect(await statuses()).toEqual(["CONFIRMED"]);
  });

  test("cancelar pide confirmación, avisa y libera la hora", async ({ page, context }) => {
    await bookAppointment(page);
    await login(page);

    const card = await openFirstPending(page);
    page.once("dialog", (dialog) => dialog.dismiss());
    await card.getByRole("button", { name: "Cancelar" }).click();
    expect(await statuses()).toEqual(["PENDING"]);

    page.once("dialog", (dialog) => dialog.accept());
    const message = await whatsappMessage(context, () => card.getByRole("button", { name: "Cancelar" }).click());
    expect(message).toContain("tuvimos que cancelar");
    await expect(pendingCards(page)).toHaveCount(0);
    expect(await statuses()).toEqual(["CANCELLED"]);

    // Esa misma hora vuelve a estar libre para otro cliente.
    await bookAppointment(page);
    expect((await statuses()).sort()).toEqual(["CANCELLED", "PENDING"]);
  });

  test("una cita del día se marca como atendida y deja de tener acciones", async ({ page }) => {
    await bookAppointment(page);
    await login(page);
    const pending = await openFirstPending(page);
    await pending.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(pendingCards(page)).toHaveCount(0);

    const day = await withE2eDatabase(async (db) => {
      const { rows } = await db.query(
        "SELECT to_char(starts_at AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS day FROM appointments",
      );
      return rows[0].day as string;
    });
    await page.goto(`/panel?dia=${day}`);
    await page.getByRole("button", { name: /Cliente Prueba, Confirmado/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const card = dialog.getByRole("article");
    await card.getByRole("button", { name: "Atendida" }).click();
    await expect(card).toContainText("Atendido");
    await expect(card.getByRole("button", { name: "Cerrar", exact: true })).toHaveCount(1);
    await expect(card.getByRole("button")).toHaveCount(1);
    expect(await statuses()).toEqual(["COMPLETED"]);
  });

  test("se puede cambiar de día y volver a hoy; una fecha inválida muestra hoy", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: todayTitle() })).toBeVisible();
    await page.getByRole("link", { name: "Día siguiente" }).click();
    await expect(page.getByRole("heading", { name: todayTitle() })).toHaveCount(0);
    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(page.getByRole("heading", { name: todayTitle() })).toBeVisible();

    await page.goto("/panel?dia=basura");
    await expect(page.getByRole("heading", { name: todayTitle() })).toBeVisible();
  });

  test("las reservas nuevas aparecen solas, sin recargar", async ({ page, browser }) => {
    await page.clock.install();
    await login(page);
    await expect(pendingCards(page)).toHaveCount(0);

    const client = await browser.newPage({ baseURL: "http://localhost:3100" });
    await bookAppointment(client);
    await client.close();

    await page.clock.fastForward(61_000);
    await expect(pendingCards(page)).toHaveCount(1);
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

test.describe("calendario", () => {
  const section = (page: Page) => page.locator('section[aria-labelledby="agenda-dia"]');
  const events = (page: Page) => section(page).getByRole("button", { name: /^\d{2}:\d{2} .+, / });
  const event = (page: Page, name: string) => section(page).getByRole("button", { name: new RegExp(`^\\d{2}:\\d{2} ${name},`) });
  const noOverflow = async (page: Page) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const axe = async (page: Page) => {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  };

  test("día en 320 px: las citas que se cruzan van lado a lado, la ficha se abre y se filtra por barbero", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const day = await seedDay();
    await login(page);
    await page.goto(`/panel?dia=${day}`);
    await expect(events(page)).toHaveCount(4);

    const risk = (await event(page, "Cliente en riesgo").boundingBox())!;
    const hunter = (await event(page, "Cazador de huecos").boundingBox())!;
    expect(risk.x + risk.width <= hunter.x || hunter.x + hunter.width <= risk.x).toBe(true);
    expect(Math.abs(risk.y - hunter.y)).toBeLessThan(4);
    expect((await event(page, "Cliente largo").boundingBox())!.height).toBeGreaterThan(hunter.height);

    await axe(page);
    await noOverflow(page);
    await event(page, "Cliente en riesgo").click();
    const dialog = page.getByRole("dialog", { name: "Cita de Cliente en riesgo" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("En riesgo");
    await expect(dialog).toContainText(/10:00 – 10:45 \(45 min\)/);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const guest = section(page).getByRole("button", { name: "Barbero invitado" });
    await guest.click();
    await expect(guest).toHaveAttribute("aria-pressed", "true");
    await expect(events(page)).toHaveCount(1);
    await section(page).getByRole("button", { name: "Todos" }).click();
    await expect(events(page)).toHaveCount(4);
  });

  test("semana en 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const day = await seedDay();
    await login(page);
    await page.goto(`/panel?vista=semana&dia=${day}`);
    await expect(page.getByRole("link", { name: "Semana", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(events(page)).toHaveCount(4);
    await noOverflow(page);
    await axe(page);
  });

  test("mes: tres píldoras y +1 más lleva a la vista día", async ({ page }) => {
    const day = await seedDay();
    await login(page);
    await page.goto(`/panel?vista=mes&dia=${day}`);
    await expect(events(page)).toHaveCount(3);
    await axe(page);
    await section(page).getByRole("link", { name: "+1 más" }).click();
    await expect(page).toHaveURL(new RegExp(`vista=dia&dia=${day}`));
    await expect(page.getByRole("link", { name: "Día", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(events(page)).toHaveCount(4);
  });

  test("escritorio: la ficha se abre junto a la cita, confirma y ofrece WhatsApp; la columna lateral cumple axe", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const day = await seedDay();
    await login(page);
    await page.goto(`/panel?dia=${day}`);
    await expect(events(page)).toHaveCount(4);
    await axe(page);

    const anchor = (await event(page, "Cliente largo").boundingBox())!;
    await event(page, "Cliente largo").click();
    const dialog = page.getByRole("dialog", { name: "Cita de Cliente largo" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    // En la vista Día la cita ocupa casi todo el ancho y no queda sitio a los lados: la ficha se recorta a la pantalla, a la altura de la cita.
    expect(box.y <= anchor.y + anchor.height && box.y + box.height >= anchor.y, "la ficha no está a la altura de la cita").toBe(true);
    await expect(dialog.getByRole("link", { name: "Enviar WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/51900000103\?text=/);
    await axe(page);

    await dialog.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(dialog).toContainText("Confirmado");
    await expect(dialog.getByRole("button", { name: "Confirmar cita" })).toHaveCount(0);
  });

  test("320 px: la columna lateral va debajo del calendario y la ficha es una hoja inferior", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const day = await seedDay();
    await login(page);
    await page.goto(`/panel?dia=${day}`);
    await expect(events(page)).toHaveCount(4);
    const [cal, side] = [(await section(page).boundingBox())!, (await pendingList(page).boundingBox())!];
    expect(side.y).toBeGreaterThanOrEqual(cal.y + cal.height - 1);
    await noOverflow(page);
    await axe(page);

    await event(page, "Cliente largo").click();
    const dialog = page.getByRole("dialog", { name: "Cita de Cliente largo" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.y + box.height - 700)).toBeLessThanOrEqual(2);
    expect(box.width).toBeGreaterThanOrEqual(318);
    await noOverflow(page);
    await axe(page);
  });

  test("canceladas y vencidas van aparte, debajo de la grilla", async ({ page }) => {
    const day = await seedDay();
    await withE2eDatabase((db) => db.query("UPDATE appointments SET status = 'EXPIRED' WHERE customer_name = 'Cliente en riesgo'"));
    await login(page);
    await page.goto(`/panel?dia=${day}`);
    await expect(section(page).getByRole("heading", { name: "Canceladas y vencidas" })).toBeVisible();
    await expect(section(page).locator("div.relative button")).toHaveCount(3);
    await event(page, "Cliente en riesgo").click();
    await expect(page.getByRole("dialog")).toContainText("Vencido");
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
    await expect(pendingCards(page)).toHaveCount(1, { timeout: 10_000 });
  });

  test("con los avisos bloqueados explica cómo permitirlos", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
    await login(page);
    await expect(page.getByRole("region", { name: "Avisos en este dispositivo" })).toContainText("Bloqueaste los avisos");
  });
});

test.describe("chats", () => {
  const ANA = "51900000001";
  const OTRO = "51900000002";

  test.beforeEach(() =>
    withE2eDatabase(async (db) => {
      await db.query("DELETE FROM assistant_messages WHERE phone IN ($1, $2)", [ANA, OTRO]);
      await db.query("INSERT INTO customers (id, name, phone) VALUES ('30000000-0000-4000-8000-0000000000a1', 'Ana de Prueba', $1)", [ANA]);
      const ago = (min: number) => new Date(Date.now() - min * 60_000);
      const add = (phone: string, role: string, content: string, min: number) =>
        db.query("INSERT INTO assistant_messages (phone, role, content, created_at) VALUES ($1, $2, $3, $4)", [phone, role, content, ago(min)]);
      await add(ANA, "user", "Quiero un corte mañana", 30);
      await add(ANA, "assistant", "Claro, te muestro los horarios", 29);
      await add(OTRO, "user", "Hola, precios?", 10);
    }),
  );
  test.afterEach(() => withE2eDatabase((db) => db.query("DELETE FROM assistant_messages WHERE phone IN ($1, $2)", [ANA, OTRO])));

  const accessible = async (page: Page, where: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), where).toEqual([]);
  };

  test("escritorio: lista, hilo de solo lectura, navegación y accesibilidad", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await page.goto("/panel/chats");
    await expect(page.getByRole("link", { name: "Chats" })).toHaveAttribute("aria-current", "page");
    const list = page.getByRole("navigation", { name: "Conversaciones" });
    await expect(list.getByRole("link", { name: /Ana de Prueba/ })).toBeVisible();
    await expect(list.getByRole("link", { name: `+${OTRO}` })).toBeVisible();
    await list.getByRole("link", { name: /Ana de Prueba/ }).click();
    const thread = page.getByRole("region", { name: "Conversación" });
    await expect(thread.getByText("Quiero un corte mañana")).toBeVisible();
    await expect(thread.getByText("Claro, te muestro los horarios")).toBeVisible();
    await expect(thread.getByText("Solo lectura · Bot automático")).toBeVisible();
    await expect(thread.getByRole("link", { name: "Escribirle por WhatsApp" })).toHaveAttribute("href", `https://wa.me/${ANA}`);
    await expect(list.getByRole("link", { name: /Ana de Prueba/ })).toHaveAttribute("aria-current", "true");
    await accessible(page, "chats escritorio");
  });

  test("320 px: la lista o el hilo, sin desbordar", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.goto("/panel/chats");
    await expect(page.getByRole("navigation", { name: "Conversaciones" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conversación" })).toBeHidden();
    await noOverflow();
    await accessible(page, "lista 320");
    await page.goto(`/panel/chats?c=${ANA}`);
    await expect(page.getByRole("navigation", { name: "Conversaciones" })).toBeHidden();
    await expect(page.getByRole("link", { name: "‹ Todos los chats" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conversación" }).getByText("Claro, te muestro los horarios")).toBeVisible();
    await noOverflow();
    await accessible(page, "hilo 320");
  });

  test("el foco se ve en la lista", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await page.goto("/panel/chats");
    const inList = () => page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="Conversaciones"]'));
    for (let i = 0; i < 30 && !(await inList()); i++) await page.keyboard.press("Tab");
    expect(await inList()).toBe(true);
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
});
