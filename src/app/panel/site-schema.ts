import { z } from "zod";
import { normalizePhone } from "@/core/entities/customer";
import { CONTACT_URL_FIELDS, type ShopContact, SITE_SECTIONS, type SiteSettings } from "@/core/entities/site";

// Formato del formulario de la web; las reglas (WhatsApp peruano, solo https) están en core/entities/site.ts.

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
  z.string().max(500, "Un campo es demasiado largo.").optional(),
);

const contactSchema = z.object({
  whatsapp: optionalText.transform((v) => (v ? normalizePhone(v) : undefined)),
  address: optionalText,
  ...Object.fromEntries(CONTACT_URL_FIELDS.map((field) => [field, optionalText])),
});

export function parseContactForm(form: FormData) {
  const fields = ["whatsapp", "address", ...CONTACT_URL_FIELDS];
  const parsed = contactSchema.safeParse(Object.fromEntries(fields.map((f) => [f, form.get(f)])));
  if (!parsed.success) return parsed;
  // Lo vacío no se guarda: así la web simplemente no lo muestra.
  const contact = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as ShopContact;
  return { success: true as const, data: contact };
}

export function parseSectionsForm(form: FormData): SiteSettings["sections"] {
  return Object.fromEntries(SITE_SECTIONS.map((s) => [s, form.get(s) === "on"])) as SiteSettings["sections"];
}
