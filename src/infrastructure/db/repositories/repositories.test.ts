import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { GetAvailableSlotsUseCase } from "@/application/use-cases/booking/get-available-slots";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import { TimeSlot } from "@/core/entities/time-slot";
import { SlotUnavailableError } from "@/core/errors/domain-errors";
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
      start: utc("15:15"),
      services: first.services,
      products: [],
    });
    await expect(deps.appointments.save(rival)).rejects.toThrow(SlotUnavailableError);
  });

  test("cancelar libera el hueco también en la base", async () => {
    const first = await book(utc("15:00"));
    await deps.appointments.save(Appointment.restore({ ...first, status: AppointmentStatus.CANCELLED }));
    await expect(book(utc("15:00"), "900000002")).resolves.toBeInstanceOf(Appointment);
  });
});
