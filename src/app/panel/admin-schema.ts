import { z } from "zod";
import { shopInstant } from "@/core/scheduling/availability";

// Frontera de confianza del panel: el formato aquí; las reglas de negocio en core/catalog/rules.ts.

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

const optionalId = z.preprocess((v) => v || undefined, z.uuid().optional());
const name = z.string().trim().min(2, "Escribe un nombre.").max(60, "El nombre es demasiado largo.");

function toCents(amount: string) {
  const [soles, cents = ""] = amount.replace(",", ".").split(".");
  return Number(soles) * 100 + Number(cents.padEnd(2, "0"));
}

const price = z
  .string()
  .trim()
  .regex(/^\d{1,5}([.,]\d{1,2})?$/, "Escribe el precio en soles, por ejemplo 30 o 30.50.")
  .transform(toCents);

const duration = z.coerce.number({ error: "Escribe la duración en minutos." }).int("Escribe la duración en minutos.");

const serviceSchema = z.object({ id: optionalId, name, durationMinutes: duration, priceCents: price, active: z.boolean() });
const productSchema = z.object({ id: optionalId, name, priceCents: price, active: z.boolean() });
const barberSchema = z.object({ id: optionalId, name, active: z.boolean() });

export const parseServiceForm = (form: FormData) =>
  serviceSchema.safeParse({
    id: form.get("id"),
    name: text(form, "name"),
    durationMinutes: text(form, "durationMinutes"),
    priceCents: text(form, "price"),
    active: form.get("active") === "on",
  });

export const parseProductForm = (form: FormData) =>
  productSchema.safeParse({
    id: form.get("id"),
    name: text(form, "name"),
    priceCents: text(form, "price"),
    active: form.get("active") === "on",
  });

export const parseBarberForm = (form: FormData) =>
  barberSchema.safeParse({ id: form.get("id"), name: text(form, "name"), active: form.get("active") === "on" });

const minuteOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe apertura y cierre de cada tramo.")
  .transform((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));

const hoursSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  hours: z.array(z.object({ openMinute: minuteOfDay, closeMinute: minuteOfDay })),
});

/** Dos tramos como máximo; un tramo vacío del todo no cuenta y sin tramos el día queda cerrado. */
export function parseHoursForm(form: FormData) {
  const hours = [1, 2]
    .map((i) => ({ openMinute: text(form, `open${i}`), closeMinute: text(form, `close${i}`) }))
    .filter((t) => t.openMinute || t.closeMinute);
  return hoursSchema.safeParse({ weekday: form.get("weekday"), hours });
}

const optionalMinute = z.preprocess((v) => v || undefined, minuteOfDay.optional());

const blockSchema = z
  .object({
    barberId: z.preprocess((v) => v || null, z.uuid().nullable()),
    from: z.iso.date({ error: "Elige la fecha de inicio." }),
    to: z.iso.date({ error: "Elige la fecha de fin." }),
    fromTime: optionalMinute,
    toTime: optionalMinute,
    reason: z.string().trim().max(120, "El motivo es demasiado largo."),
  })
  .transform(({ barberId, from, to, fromTime, toTime, reason }) => ({
    barberId,
    start: shopInstant(from, fromTime ?? 0),
    end: shopInstant(to, toTime ?? 1440),
    reason: reason || null,
  }));

export const parseBlockForm = (form: FormData) =>
  blockSchema.safeParse({
    barberId: form.get("barberId"),
    from: text(form, "from"),
    to: text(form, "to"),
    fromTime: text(form, "fromTime"),
    toTime: text(form, "toTime"),
    reason: text(form, "reason"),
  });
