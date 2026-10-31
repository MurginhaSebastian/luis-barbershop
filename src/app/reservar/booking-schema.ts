import { z } from "zod";

// Frontera de confianza: todo lo que llega del navegador (URL o formulario) pasa por aquí.

const toArray = (v: unknown) => (v === undefined || v === null ? [] : [v].flat());
const serviceIds = z.preprocess(toArray, z.array(z.uuid()).min(1).max(5));

/** Parámetros de la URL para mostrar horarios: ?servicios=…&barbero=…&dia=YYYY-MM-DD */
export const slotQuerySchema = z.object({
  servicios: serviceIds,
  barbero: z.uuid(),
  dia: z.iso.date(),
});

export const bookingSchema = z.object({
  barberId: z.uuid(),
  serviceIds,
  products: z
    .array(z.object({ productId: z.uuid(), quantity: z.coerce.number().int().min(1).max(10) }))
    .max(10),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(60, "El nombre es demasiado largo."),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+?51)?9\d{8}$/, "Escribe un celular de 9 dígitos que empiece por 9.")),
  start: z.iso.datetime({ error: "Elige un horario." }).transform((s) => new Date(s)),
});

/** Los productos llegan como campos `qty:<id>` con la cantidad elegida (0 = no lo quiere). */
export function parseBookingForm(form: FormData) {
  return bookingSchema.safeParse({
    barberId: form.get("barberId"),
    serviceIds: form.getAll("serviceIds"),
    products: [...form.entries()]
      .filter(([key, value]) => key.startsWith("qty:") && value !== "0" && value !== "")
      .map(([key, value]) => ({ productId: key.slice(4), quantity: value })),
    name: form.get("name") ?? "",
    phone: form.get("phone") ?? "",
    start: form.get("start") ?? "",
  });
}
