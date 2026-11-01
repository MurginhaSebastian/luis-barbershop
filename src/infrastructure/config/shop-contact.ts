import { z } from "zod";

// Datos de contacto del negocio: viven en variables de entorno porque el repositorio es público.
const optionalUrl = z.url().optional().catch(undefined);
const schema = z.object({
  whatsapp: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^51\d{9}$/))
    .optional()
    .catch(undefined),
  address: z.string().trim().min(1).optional().catch(undefined),
  mapsUrl: optionalUrl,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  complaintsUrl: optionalUrl,
});

export type ShopContact = z.infer<typeof schema>;

/** Lo que falte o sea inválido queda en undefined y la UI simplemente no lo muestra. */
export function getShopContact(): ShopContact {
  const env = process.env;
  return schema.parse({
    whatsapp: env.SHOP_WHATSAPP || undefined,
    address: env.SHOP_ADDRESS || undefined,
    mapsUrl: env.SHOP_MAPS_URL || undefined,
    instagramUrl: env.SHOP_INSTAGRAM_URL || undefined,
    facebookUrl: env.SHOP_FACEBOOK_URL || undefined,
    tiktokUrl: env.SHOP_TIKTOK_URL || undefined,
    complaintsUrl: env.SHOP_COMPLAINTS_URL || undefined,
  });
}
