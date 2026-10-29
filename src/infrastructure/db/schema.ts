import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const appointmentStatus = pgEnum("appointment_status", [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const barbers = pgTable("barbers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  active: boolean().notNull().default(true),
});

export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [
    check("services_duration_positive", sql`${t.durationMinutes} > 0`),
    check("services_price_non_negative", sql`${t.priceCents} >= 0`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    priceCents: integer("price_cents").notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [check("products_price_non_negative", sql`${t.priceCents} >= 0`)],
);

export const customers = pgTable("customers", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  /** Normalizado con normalizePhone del dominio. */
  phone: text().notNull().unique(),
});

/** Horario común de la barbería; varios tramos por día permiten partir la jornada. */
export const businessHours = pgTable(
  "business_hours",
  {
    weekday: smallint().notNull(),
    openMinute: smallint("open_minute").notNull(),
    closeMinute: smallint("close_minute").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weekday, t.openMinute] }),
    check("business_hours_weekday", sql`${t.weekday} BETWEEN 0 AND 6`),
    check("business_hours_range", sql`0 <= ${t.openMinute} AND ${t.openMinute} < ${t.closeMinute} AND ${t.closeMinute} <= 1440`),
  ],
);

/** barber_id NULL = bloqueo de toda la barbería (feriado, cierre). */
export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: uuid().primaryKey().defaultRandom(),
    barberId: uuid("barber_id").references(() => barbers.id, { onDelete: "cascade" }),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    reason: text(),
  },
  (t) => [
    check("schedule_blocks_range", sql`${t.endsAt} > ${t.startsAt}`),
    index("schedule_blocks_barber_starts_idx").on(t.barberId, t.startsAt),
  ],
);

// La restricción que impide solapes por barbero está en la migración 0001 (Drizzle no modela EXCLUDE).
export const appointments = pgTable(
  "appointments",
  {
    id: uuid().primaryKey(),
    barberId: uuid("barber_id").notNull().references(() => barbers.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    status: appointmentStatus().notNull().default("PENDING"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("appointments_range", sql`${t.endsAt} > ${t.startsAt}`),
    index("appointments_barber_starts_idx").on(t.barberId, t.startsAt),
  ],
);

/** Foto del servicio al reservar (nombre, duración y precio de ese momento). */
export const appointmentServices = pgTable(
  "appointment_services",
  {
    appointmentId: uuid("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    name: text().notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.appointmentId, t.position] })],
);

export const appointmentProducts = pgTable(
  "appointment_products",
  {
    appointmentId: uuid("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    productId: uuid("product_id").notNull().references(() => products.id),
    name: text().notNull(),
    quantity: integer().notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.appointmentId, t.position] }),
    check("appointment_products_quantity_positive", sql`${t.quantity} > 0`),
  ],
);
