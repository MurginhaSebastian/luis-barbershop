import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { BotToolExecutor } from "@/application/use-cases/assistant/bot-tool-executor";
import { BookingConfirmationUseCase } from "@/application/use-cases/booking/booking-confirmation";
import { ConfirmationCycleUseCase } from "@/application/use-cases/booking/confirmation-cycle";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { ManageCatalogUseCase } from "@/application/use-cases/admin/manage-catalog";
import { ManageScheduleUseCase } from "@/application/use-cases/admin/manage-schedule";
import { ManageSiteUseCase } from "@/application/use-cases/admin/manage-site";
import { DEFAULT_SITE_SETTINGS } from "@/core/entities/site";
import { InvalidSettingsError } from "@/core/errors/domain-errors";
import { DrizzleSiteSettingsRepository } from "./site-settings-repository";
import { DrizzlePushSubscriptionRepository } from "./push-subscription-repository";
import { DrizzleConfirmationRepository } from "./confirmation-repository";
import { DrizzleProcessedMessageRepository } from "./processed-message-repository";
import { DrizzleServiceRepository as ServiceRepo } from "./catalog-repositories";
import { ChangeAppointmentStatusUseCase } from "@/application/use-cases/agenda/change-appointment-status";
import { GetAgendaUseCase } from "@/application/use-cases/agenda/get-agenda";
import { GetAvailableSlotsUseCase } from "@/application/use-cases/booking/get-available-slots";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import { TimeSlot } from "@/core/entities/time-slot";
import { SlotUnavailableError, TooManyActiveAppointmentsError } from "@/core/errors/domain-errors";
import type { Db } from "../client";
import * as schema from "../schema";
import { DrizzleAppointmentRepository } from "./appointment-repository";
import { DrizzleBarberRepository, DrizzleProductRepository, DrizzleServiceRepository } from "./catalog-repositories";
import { DrizzleCustomerRepository } from "./customer-repository";
import { DrizzleScheduleRepository } from "./schedule-repository";

// Necesita el Postgres local (`npm run db:up`); sin DATABASE_URL se salta.
try {
  process.loadEnvFile();
} catch {}
const TEST_DB = "barbershop_test";
const baseUrl = process.env.DATABASE_URL;

// Datos ficticios. Lunes 2026-11-02, Lima 10:00–12:00 = 15:00–17:00 UTC.
const NOW = new Date("2026-11-01T12:00:00Z");
const DATE = "2026-11-02";
const utc = (hhmm: string) => new Date(`${DATE}T${hhmm}:00Z`);
const BARBER = "00000000-0000-4000-8000-000000000001";
const OTHER_BARBER = "00000000-0000-4000-8000-000000000002";
const CORTE = "00000000-0000-4000-8000-000000000011";
const CERA = "00000000-0000-4000-8000-000000000021";

describe.skipIf(!baseUrl)("repositorios Drizzle (Postgres)", () => {
  let db: Db;
  let deps: ConstructorParameters<typeof CreateAppointmentUseCase>[0];

  beforeAll(async () => {
    const admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${TEST_DB}`);
    await admin.end();

    const url = new URL(baseUrl!);
    url.pathname = `/${TEST_DB}`;
    db = drizzle(url.toString(), { schema });
    await migrate(db, { migrationsFolder: "src/infrastructure/db/migrations" });

    deps = {
      barbers: new DrizzleBarberRepository(db),
      services: new DrizzleServiceRepository(db),
      products: new DrizzleProductRepository(db),
      customers: new DrizzleCustomerRepository(db),
      schedule: new DrizzleScheduleRepository(db),
      appointments: new DrizzleAppointmentRepository(db),
      now: () => NOW,
    };
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE barbers, services, products, customers, business_hours, schedule_blocks, appointments, site_settings, push_subscriptions, booking_confirmations, processed_messages CASCADE`);
    await db.insert(schema.barbers).values({ id: BARBER, name: "Barbero A" });
    await db.insert(schema.services).values({ id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 3000 });
    await db.insert(schema.products).values({ id: CERA, name: "Cera", priceCents: 2500 });
    await db.insert(schema.businessHours).values({ weekday: 1, openMinute: 600, closeMinute: 720 });
  });

  const book = async (start: Date, phone = "900000001") =>
    (
      await new CreateAppointmentUseCase(deps).execute({
        barberId: BARBER,
        serviceIds: [CORTE],
        products: [{ productId: CERA, quantity: 2 }],
        customer: { name: "Cliente Prueba", phone },
        start,
      })
    ).appointment;

  test("reserva de punta a punta y la lee de vuelta con sus líneas", async () => {
    await db.insert(schema.scheduleBlocks).values({ barberId: null, startsAt: utc("16:30"), endsAt: utc("17:00") });
    const booked = await book(utc("15:30"));

    const slots = await new GetAvailableSlotsUseCase(deps).execute({ barberId: BARBER, serviceIds: [CORTE], date: DATE });
    expect(slots.map((s) => s.start.toISOString().slice(11, 16))).toEqual(["15:00", "16:00"]);

    const [stored] = await deps.appointments.findByBarberInRange(BARBER, TimeSlot.create(utc("00:00"), utc("23:00")));
    expect(stored).toEqual(booked);
    expect(stored.totalCents).toBe(3000 + 2 * 2500);
    expect((await deps.customers.findByPhone("51900000001"))?.id).toBe(booked.customerId);
  });

  test("la base rechaza un solape aunque el caso de uso no lo vea (reservas simultáneas)", async () => {
    const first = await book(utc("15:00"));
    const rival = Appointment.book({
      id: crypto.randomUUID(),
      barberId: BARBER,
      customerId: first.customerId,
      customerName: "Rival",
      start: utc("15:15"),
      bookedAt: NOW,
      services: first.services,
      products: [],
    });
    await expect(deps.appointments.save(rival)).rejects.toThrow(SlotUnavailableError);
  });

  test("una cita en riesgo deja tomar su hueco; si ya lo tomaron, no puede volver a confirmarse", async () => {
    const first = await book(utc("15:00"));
    const atRisk = first.changeStatus(AppointmentStatus.AT_RISK);
    expect(await deps.appointments.updateStatus(atRisk, AppointmentStatus.PENDING)).toBe(true);
    const rival = Appointment.book({ ...first, id: crypto.randomUUID(), customerName: "Rival", start: utc("15:00"), bookedAt: NOW });
    await deps.appointments.save(rival);
    await expect(
      deps.appointments.updateStatus(atRisk.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.AT_RISK),
    ).rejects.toThrow(SlotUnavailableError);
    expect((await deps.appointments.findById(first.id))?.status).toBe(AppointmentStatus.AT_RISK);
  });

  test("tomar un hueco en riesgo vence la cita anterior en la misma transacción", async () => {
    const first = await book(utc("15:00"));
    const atRisk = first.changeStatus(AppointmentStatus.AT_RISK);
    await deps.appointments.updateStatus(atRisk, AppointmentStatus.PENDING);
    const hunter = Appointment.book({ ...first, id: crypto.randomUUID(), start: utc("15:00"), bookedAt: utc("14:50") });
    await deps.appointments.save(hunter, [atRisk]);
    expect((await deps.appointments.findById(first.id))?.status).toBe(AppointmentStatus.EXPIRED);
    expect((await deps.appointments.findById(hunter.id))?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  test("si el cliente en riesgo confirmó justo antes, la nueva reserva no se guarda", async () => {
    const first = await book(utc("15:00"));
    const atRisk = first.changeStatus(AppointmentStatus.AT_RISK);
    await deps.appointments.updateStatus(atRisk, AppointmentStatus.PENDING);
    await deps.appointments.updateStatus(atRisk.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.AT_RISK);
    const hunter = Appointment.book({ ...first, id: crypto.randomUUID(), start: utc("15:00"), bookedAt: utc("14:50") });
    await expect(deps.appointments.save(hunter, [atRisk])).rejects.toThrow(SlotUnavailableError);
    expect(await deps.appointments.findById(hunter.id)).toBeNull();
    expect((await deps.appointments.findById(first.id))?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  test("el aviso de -35 min se marca una sola vez, y solo si sigue pendiente", async () => {
    const booked = await book(utc("15:00"));
    const other = await book(utc("16:00"), "900000002");
    expect(await deps.appointments.claimReminder(booked.id, utc("14:25"))).toBe(true);
    expect(await deps.appointments.claimReminder(booked.id, utc("14:30"))).toBe(false); // otro cron a la vez
    await deps.appointments.releaseReminder(booked.id); // el aviso no salió
    expect(await deps.appointments.claimReminder(booked.id, utc("14:30"))).toBe(true);
    await deps.appointments.updateStatus(other.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.PENDING);
    expect(await deps.appointments.claimReminder(other.id, utc("15:25"))).toBe(false);
    const sent = await db.select({ at: schema.appointments.reminderSentAt }).from(schema.appointments).where(sql`id = ${booked.id}`);
    expect(sent).toEqual([{ at: utc("14:30") }]);
  });

  test("guarda cuándo se confirmó la cita", async () => {
    const booked = await book(utc("15:00"));
    const confirmedAt = async () =>
      (await db.select({ at: schema.appointments.confirmedAt }).from(schema.appointments)).map((r) => r.at);
    expect(await confirmedAt()).toEqual([null]);
    await deps.appointments.updateStatus(booked.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.PENDING);
    expect((await confirmedAt())[0]).toBeInstanceOf(Date);
  });

  test("dos reservas simultáneas de un cliente nuevo comparten cliente", async () => {
    const [a, b] = await Promise.all([book(utc("15:00"), "900000003"), book(utc("16:00"), "+51 900 000 003")]);
    expect(a.customerId).toBe(b.customerId);
  });

  test("cuenta las citas futuras del cliente en la base", async () => {
    await book(utc("15:00"));
    await book(utc("15:30"));
    await expect(book(utc("16:00"))).rejects.toThrow(TooManyActiveAppointmentsError);
  });

  test("la agenda lee citas, clientes y barberos, y confirmar las saca de pendientes", async () => {
    const booked = await book(utc("15:00"));
    const getAgenda = new GetAgendaUseCase({ ...deps, confirmations: new DrizzleConfirmationRepository(db) });

    const before = await getAgenda.execute({ date: DATE });
    expect(before.pending.map((i) => i.id)).toEqual([booked.id]);
    expect(before.day[0]).toMatchObject({
      customerName: "Cliente Prueba",
      phone: "51900000001",
      barberName: "Barbero A",
      services: ["Corte"],
      products: ["2 × Cera"],
    });

    await new ChangeAppointmentStatusUseCase(deps).execute({ id: booked.id, status: AppointmentStatus.CONFIRMED });
    const after = await getAgenda.execute({ date: DATE });
    expect(after.pending).toEqual([]);
    expect(after.day[0].status).toBe(AppointmentStatus.CONFIRMED);
    expect((await deps.appointments.findById(booked.id))?.services).toEqual(booked.services);
  });

  describe("administración", () => {
    test("editar un precio se ve en el catálogo y no altera una cita ya reservada", async () => {
      const booked = await book(utc("15:00"));
      const catalog = new ManageCatalogUseCase(deps);
      await catalog.saveService({ id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 9900, active: true });

      expect((await deps.services.findByIds([CORTE]))[0].priceCents).toBe(9900);
      expect((await deps.appointments.findById(booked.id))?.totalCents).toBe(booked.totalCents);
    });

    test("lo oculto sale del catálogo público pero sigue en el panel", async () => {
      const catalog = new ManageCatalogUseCase(deps);
      await catalog.saveProduct({ id: CERA, name: "Cera", priceCents: 2500, active: false });
      expect(await deps.products.findAllActive()).toEqual([]);
      expect(await catalog.listProducts()).toHaveLength(1);
    });

    test("un alta nueva aparece en el catálogo", async () => {
      const catalog = new ManageCatalogUseCase(deps);
      await catalog.saveBarber({ name: "Barbero C", active: true });
      expect((await catalog.listBarbers()).map((b) => b.name)).toEqual(["Barbero A", "Barbero C"]);
    });

    test("cambiar el horario de un día cambia las horas ofrecidas", async () => {
      await new ManageScheduleUseCase(deps).saveDayHours(1, [{ openMinute: 660, closeMinute: 690 }]);
      const slots = await new GetAvailableSlotsUseCase(deps).execute({ barberId: BARBER, serviceIds: [CORTE], date: DATE });
      expect(slots.map((s) => s.start.toISOString().slice(11, 16))).toEqual(["16:00"]);
    });

    test("cerrar un día lo deja sin horas", async () => {
      await new ManageScheduleUseCase(deps).saveDayHours(1, []);
      expect(await new GetAvailableSlotsUseCase(deps).execute({ barberId: BARBER, serviceIds: [CORTE], date: DATE })).toEqual([]);
    });

    test("un bloqueo quita sus horas y al borrarlo vuelven", async () => {
      const schedule = new ManageScheduleUseCase(deps);
      const hours = () => new GetAvailableSlotsUseCase(deps).execute({ barberId: BARBER, serviceIds: [CORTE], date: DATE });
      const before = (await hours()).length;

      await schedule.addBlock({ barberId: null, slot: TimeSlot.create(utc("15:00"), utc("16:00")), reason: "Feriado" });
      expect((await hours()).length).toBe(before - 2);

      const [block] = await schedule.listBlocks();
      expect(block).toMatchObject({ barberName: null, reason: "Feriado" });
      await schedule.removeBlock(block.id);
      expect((await hours()).length).toBe(before);
    });
  });

  test("suscripciones push: una por dispositivo, se actualizan y se borran", async () => {
    const repo = new DrizzlePushSubscriptionRepository(db);
    const sub = { endpoint: "https://push.example/1", p256dh: "B".repeat(87), auth: "a".repeat(22) };
    await repo.save(sub);
    await repo.save({ ...sub, auth: "b".repeat(22) });
    await repo.save({ ...sub, endpoint: "https://push.example/2" });
    expect(await repo.findAll()).toHaveLength(2);
    expect((await repo.findAll()).find((s) => s.endpoint === sub.endpoint)?.auth).toBe("b".repeat(22));
    await repo.remove(sub.endpoint);
    expect((await repo.findAll()).map((s) => s.endpoint)).toEqual(["https://push.example/2"]);
  });

  test("confirmaciones: por código y por cita", async () => {
    const repo = new DrizzleConfirmationRepository(db);
    const first = await book(utc("15:00"));
    const second = await book(utc("16:00"), "900000002");
    await repo.save({ appointmentId: first.id, code: "KRT482", confirmBy: utc("10:00") });
    await repo.save({ appointmentId: second.id, code: "KRT482", confirmBy: utc("11:00") });

    // Mismo código para dos clientes: se devuelven ambos y decide quien llama.
    expect((await repo.findByCode("KRT482")).map((c) => c.appointmentId).sort()).toEqual([first.id, second.id].sort());
    expect(await repo.findByCode("AAA222")).toEqual([]);

    // Volver a guardar sustituye código y plazo.
    await repo.save({ appointmentId: second.id, code: "PQR789", confirmBy: utc("12:00") });
    expect(await repo.findByAppointments([second.id, "00000000-0000-4000-8000-000000000999"])).toEqual([
      { appointmentId: second.id, code: "PQR789", confirmBy: utc("12:00") },
    ]);
    expect(await repo.findByAppointments([])).toEqual([]);
  });

  test("cambiar estado solo si sigue como se leyó", async () => {
    const booked = await book(utc("15:00"));
    expect(await deps.appointments.updateStatus(booked.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.PENDING)).toBe(true);
    // Ya no está pendiente: ponerla en riesgo ahora pisaría la confirmación.
    expect(await deps.appointments.updateStatus(booked.changeStatus(AppointmentStatus.AT_RISK), AppointmentStatus.PENDING)).toBe(false);
    expect((await deps.appointments.findById(booked.id))?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  test("mensajes atendidos: marcar dos veces no falla", async () => {
    const repo = new DrizzleProcessedMessageRepository(db);
    expect(await repo.wasProcessed("wamid.1")).toBe(false);
    await repo.markProcessed("wamid.1");
    await repo.markProcessed("wamid.1");
    expect(await repo.wasProcessed("wamid.1")).toBe(true);
    expect(await repo.wasProcessed("wamid.2")).toBe(false);
  });

  describe("ajustes de la web", () => {
    const site = () =>
      new ManageSiteUseCase({
        siteSettings: new DrizzleSiteSettingsRepository(db),
        services: new ServiceRepo(db),
        images: null,
        imageOptimizer: { toWebp: async (b) => b },
      });

    test("sin nada guardado da los valores por defecto", async () => {
      expect(await site().get()).toEqual(DEFAULT_SITE_SETTINGS);
    });

    test("guardar contacto no borra las secciones, y al revés", async () => {
      await site().saveSections({ ...DEFAULT_SITE_SETTINGS.sections, products: false });
      await site().saveContact({ whatsapp: "51900000000", mapsUrl: "https://maps.google.com/?q=Lima" });
      await site().saveSections({ ...DEFAULT_SITE_SETTINGS.sections, about: false });

      const settings = await site().get();
      expect(settings.contact).toEqual({ whatsapp: "51900000000", mapsUrl: "https://maps.google.com/?q=Lima" });
      expect(settings.sections).toEqual({ ...DEFAULT_SITE_SETTINGS.sections, about: false });
    });

    test("editar un servicio desde el panel no le borra la foto", async () => {
      const services = new ServiceRepo(db);
      const [corte] = await services.findByIds([CORTE]);
      await services.save({ ...corte, imageUrl: "/imagenes/00000000-0000-4000-8000-000000000009.webp" });

      await new ManageCatalogUseCase(deps).saveService({ id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 4000, active: true });
      const [after] = await services.findByIds([CORTE]);
      expect(after).toMatchObject({ priceCents: 4000, imageUrl: "/imagenes/00000000-0000-4000-8000-000000000009.webp" });

      await services.save({ ...after, imageUrl: null });
      expect((await services.findByIds([CORTE]))[0].imageUrl).toBeNull();
    });

    test("un enlace peligroso no se guarda", async () => {
      await expect(site().saveContact({ mapsUrl: "javascript:alert(1)" })).rejects.toThrow(InvalidSettingsError);
      expect((await site().get()).contact).toEqual({});
    });
  });

  describe("reservas simultáneas", () => {
    const race = (attempts: number, barberId: string | null) =>
      Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          new CreateAppointmentUseCase(deps).execute({
            barberId,
            serviceIds: [CORTE],
            customer: { name: `Cliente ${i}`, phone: `9000001${String(i).padStart(2, "0")}` },
            start: utc("15:00"),
          }),
        ),
      );

    test("de 10 personas a la misma hora solo una consigue la cita", async () => {
      const results = await race(10, BARBER);
      const failed = results.filter((r) => r.status === "rejected");
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(failed).toHaveLength(9);
      for (const r of failed) expect((r).reason).toBeInstanceOf(SlotUnavailableError);
      expect(await db.select().from(schema.appointments)).toHaveLength(1);
    });

    test("sin preferencia, cada barbero recibe una cita y nadie se solapa", async () => {
      await db.insert(schema.barbers).values({ id: OTHER_BARBER, name: "Barbero B" });
      const results = await race(6, null);
      const booked = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.appointment.barberId] : []));
      expect(booked.toSorted()).toEqual([BARBER, OTHER_BARBER].toSorted());
      expect(await db.select().from(schema.appointments)).toHaveLength(2);
    });
  });

  test("cancelar libera el hueco también en la base", async () => {
    const first = await book(utc("15:00"));
    await deps.appointments.save(Appointment.restore({ ...first, status: AppointmentStatus.CANCELLED }));
    await expect(book(utc("15:00"), "900000002")).resolves.toBeInstanceOf(Appointment);
  });

  describe("asistente y ciclo de confirmaciones", () => {
    const report = { sent: 0, removed: 0, failed: 0 };
    function world() {
      const clock = { now: NOW };
      const sendTemplate = vi.fn(async () => {});
      const base = {
        ...deps,
        now: () => clock.now,
        confirmations: new DrizzleConfirmationRepository(db),
        processedMessages: new DrizzleProcessedMessageRepository(db),
        siteSettings: new DrizzleSiteSettingsRepository(db),
        messaging: { sendText: async () => {}, sendTemplate },
        confirmationNumber: "51911111111",
        randomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
      };
      const bot = new BotToolExecutor({
        ...base,
        availability: new GetAvailableSlotsUseCase(base),
        booking: new CreateAppointmentUseCase(base),
        confirmation: new BookingConfirmationUseCase(base),
        push: { notifyNewBooking: async () => report, notifyConfirmed: async () => report, notifyCancelled: async () => report },
      });
      const cycle = new ConfirmationCycleUseCase({ ...base, alerts: { notifyAtRisk: async () => report } });
      const at = (hhmm: string) => {
        clock.now = utc(hhmm);
        return cycle.run();
      };
      return { bot, at, sendTemplate };
    }
    const statuses = async () => (await db.select({ status: schema.appointments.status }).from(schema.appointments)).map((r) => r.status);

    test("una reserva del asistente con 2 h o más entra en el ciclo: -35, -15 y 0 min, sin repetir el aviso", async () => {
      const { bot, at, sendTemplate } = world();
      const booked = await bot.executeTool(
        {
          name: "reservar_cita",
          arguments: { customerName: "Cliente Bot", serviceIds: [CORTE], barberId: BARBER, startTime: "2026-11-02T10:00:00-05:00" },
        },
        { verifiedPhone: "51900000077", now: NOW },
      );
      expect(booked).toMatchObject({ ok: true, data: { appointment: { status: "PENDING" } } });

      // 10:00 en Lima = 15:00 UTC. Correr el ciclo dos veces en el mismo minuto, o cada minuto, no repite el aviso.
      expect(await at("14:30")).toEqual({ reminded: 1, atRisk: 0, expired: 0, failed: 0 });
      expect(await at("14:30")).toEqual({ reminded: 0, atRisk: 0, expired: 0, failed: 0 });
      expect(await at("14:31")).toMatchObject({ reminded: 0 });
      expect(sendTemplate).toHaveBeenCalledTimes(1);
      expect(sendTemplate).toHaveBeenCalledWith("51900000077", "recordatorio_cita", expect.any(Array), [
        expect.stringMatching(/^Confirmo mi cita [A-Z]{3}\d{3}$/),
        expect.stringMatching(/^Cancelar [A-Z]{3}\d{3}$/),
      ]);
      const [{ sentAt }] = await db.select({ sentAt: schema.appointments.reminderSentAt }).from(schema.appointments);
      expect(sentAt).toEqual(utc("14:30"));

      expect(await at("14:45")).toMatchObject({ atRisk: 1 });
      expect(await statuses()).toEqual(["AT_RISK"]);
      expect(await at("15:00")).toMatchObject({ expired: 1 });
      expect(await statuses()).toEqual(["EXPIRED"]);
    });

    test("pendientes o confirmadas cuya hora ya pasó no pasan solas a vencida ni a no vino: las decide Luis", async () => {
      const { at } = world();
      const pending = await book(utc("15:00"));
      await new DrizzleConfirmationRepository(db).save({ appointmentId: pending.id, code: "KRT482", confirmBy: utc("14:45") });
      const confirmed = await book(utc("16:00"), "900000002");
      await deps.appointments.updateStatus(confirmed.changeStatus(AppointmentStatus.CONFIRMED), AppointmentStatus.PENDING);

      expect(await at("17:30")).toEqual({ reminded: 0, atRisk: 0, expired: 0, failed: 0 });
      expect((await statuses()).sort()).toEqual(["CONFIRMED", "PENDING"]);
    });
  });
});
