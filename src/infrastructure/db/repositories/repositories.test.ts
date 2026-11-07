import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { ManageCatalogUseCase } from "@/application/use-cases/admin/manage-catalog";
import { ManageScheduleUseCase } from "@/application/use-cases/admin/manage-schedule";
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
    await db.execute(sql`TRUNCATE barbers, services, products, customers, business_hours, schedule_blocks, appointments CASCADE`);
    await db.insert(schema.barbers).values({ id: BARBER, name: "Barbero A" });
    await db.insert(schema.services).values({ id: CORTE, name: "Corte", durationMinutes: 30, priceCents: 3000 });
    await db.insert(schema.products).values({ id: CERA, name: "Cera", priceCents: 2500 });
    await db.insert(schema.businessHours).values({ weekday: 1, openMinute: 600, closeMinute: 720 });
  });

  const book = (start: Date, phone = "900000001") =>
    new CreateAppointmentUseCase(deps).execute({
      barberId: BARBER,
      serviceIds: [CORTE],
      products: [{ productId: CERA, quantity: 2 }],
      customer: { name: "Cliente Prueba", phone },
      start,
    });

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
      services: first.services,
      products: [],
    });
    await expect(deps.appointments.save(rival)).rejects.toThrow(SlotUnavailableError);
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
    const getAgenda = new GetAgendaUseCase(deps);

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
      for (const r of failed) expect((r as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
      expect(await db.select().from(schema.appointments)).toHaveLength(1);
    });

    test("sin preferencia, cada barbero recibe una cita y nadie se solapa", async () => {
      await db.insert(schema.barbers).values({ id: OTHER_BARBER, name: "Barbero B" });
      const results = await race(6, null);
      const booked = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.barberId] : []));
      expect(booked.toSorted()).toEqual([BARBER, OTHER_BARBER].toSorted());
      expect(await db.select().from(schema.appointments)).toHaveLength(2);
    });
  });

  test("cancelar libera el hueco también en la base", async () => {
    const first = await book(utc("15:00"));
    await deps.appointments.save(Appointment.restore({ ...first, status: AppointmentStatus.CANCELLED }));
    await expect(book(utc("15:00"), "900000002")).resolves.toBeInstanceOf(Appointment);
  });
});
