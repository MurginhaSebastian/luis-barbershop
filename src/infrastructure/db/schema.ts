import { sql } from "drizzle-orm";
import { bigserial, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const appointmentStatus = pgEnum("appointment_status", [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
  "AT_RISK",
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
    imageUrl: text("image_url"),
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

// La restricción que impide solapes por barbero está en las migraciones 0001 y 0009 (Drizzle no modela EXCLUDE).
export const appointments = pgTable(
  "appointments",
  {
    id: uuid().primaryKey(),
    barberId: uuid("barber_id").notNull().references(() => barbers.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    customerName: text("customer_name").notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    status: appointmentStatus().notNull().default("PENDING"),
    createdAt: instant("created_at").notNull().defaultNow(),
    /** Cuándo pasó a CONFIRMED (al nacer, por el cliente o por el barbero). */
    confirmedAt: instant("confirmed_at"),
    /** Cuándo se le pidió confirmar, 35 min antes. */
    reminderSentAt: instant("reminder_sent_at"),
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

/** Una sola fila con lo que se ve en la portada; se lee con readSiteSettings, que completa lo que falte. */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: smallint().primaryKey().default(1),
    data: jsonb().notNull(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [check("site_settings_single_row", sql`${t.id} = 1`)],
);

/** Dispositivos del panel que reciben avisos push; el endpoint identifica al dispositivo. */
export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text().primaryKey(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
});

/** Código y plazo para confirmar cada cita por WhatsApp. El código no es único: se busca junto al celular. */
export const bookingConfirmations = pgTable(
  "booking_confirmations",
  {
    appointmentId: uuid("appointment_id")
      .primaryKey()
      .references(() => appointments.id, { onDelete: "cascade" }),
    code: text().notNull(),
    confirmBy: instant("confirm_by").notNull(),
  },
  (t) => [index("booking_confirmations_code_idx").on(t.code), index("booking_confirmations_confirm_by_idx").on(t.confirmBy)],
);

/**
 * Lo último que se dijeron el cliente y el asistente de IA, para que entienda "¿a qué hora?" en el siguiente
 * mensaje. Solo se usan las 2 últimas horas y lo más viejo se borra al escribir: no es un archivo de chats.
 */
export const assistantMessages = pgTable(
  "assistant_messages",
  {
    // Secuencia, no uuid: dos turnos guardados en el mismo instante conservan su orden.
    id: bigserial({ mode: "number" }).primaryKey(),
    phone: text().notNull(),
    role: text().notNull(),
    content: text().notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    check("assistant_messages_role", sql`${t.role} IN ('user', 'assistant')`),
    index("assistant_messages_phone_idx").on(t.phone, t.createdAt),
  ],
);

/** Mensajes de WhatsApp ya atendidos, para no repetir la respuesta cuando Meta reintenta el aviso. */
export const processedMessages = pgTable("processed_messages", {
  messageId: text("message_id").primaryKey(),
  processedAt: instant("processed_at").notNull().defaultNow(),
});
