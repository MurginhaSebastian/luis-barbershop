import { type BusinessHours } from "@/core/scheduling/availability";
import { SHOP_NAME, type ShopContact } from "@/core/entities/site";
import { formatMinuteOfDay, formatPrice } from "./format";

export interface JsonLdInput {
  url: string;
  contact: ShopContact;
  services: readonly { name: string; priceCents: number }[];
  /** Índice 0 = domingo. */
  weeklyHours: readonly (readonly BusinessHours[])[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const soles = (cents: number) => (cents / 100).toFixed(2);

export function shopJsonLd({ url, contact, services, weeklyHours }: JsonLdInput) {
  const sameAs = [contact.instagramUrl, contact.facebookUrl, contact.tiktokUrl].filter(Boolean);
  const prices = services.map((s) => s.priceCents);
  return {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: SHOP_NAME,
    url,
    currenciesAccepted: "PEN",
    ...(contact.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: contact.address,
        addressLocality: "Trujillo",
        addressRegion: "La Libertad",
        addressCountry: "PE",
      },
    }),
    ...(contact.whatsapp && { telephone: `+${contact.whatsapp}` }),
    ...(sameAs.length && { sameAs }),
    ...(contact.mapsUrl && { hasMap: contact.mapsUrl }),
    ...(prices.length && { priceRange: `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}` }),
    ...(weeklyHours.some((d) => d.length) && {
      openingHoursSpecification: weeklyHours.flatMap((day, i) =>
        day.map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${DAYS[i]}`,
          opens: formatMinuteOfDay(h.openMinute),
          closes: formatMinuteOfDay(h.closeMinute),
        })),
      ),
    }),
    ...(services.length && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Servicios",
        itemListElement: services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name },
          price: soles(s.priceCents),
          priceCurrency: "PEN",
        })),
      },
    }),
  };
}

/** Serializa para un <script>: sin escapar "<", un texto del panel podría cerrarlo. */
export const jsonLdHtml = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
