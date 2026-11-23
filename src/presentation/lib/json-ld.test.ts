import { describe, expect, it } from "vitest";
import { jsonLdHtml, shopJsonLd } from "./json-ld";

const url = "https://ejemplo.test";

describe("shopJsonLd", () => {
  it("arma el objeto completo", () => {
    const data = shopJsonLd({
      url,
      contact: {
        address: "Calle Falsa 123",
        whatsapp: "51900000000",
        instagramUrl: "https://instagram.com/ejemplo",
        facebookUrl: "https://facebook.com/ejemplo",
        tiktokUrl: "https://tiktok.com/@ejemplo",
        mapsUrl: "https://maps.example/ejemplo",
      },
      services: [
        { name: "Corte", priceCents: 2500 },
        { name: "Barba", priceCents: 1500 },
      ],
      weeklyHours: [[], [{ openMinute: 600, closeMinute: 840 }], [], [], [], [], []],
    });
    expect(data.telephone).toBe("+51900000000");
    expect(data.sameAs).toHaveLength(3);
    expect(data.hasMap).toBe("https://maps.example/ejemplo");
    expect(data.address).toMatchObject({ streetAddress: "Calle Falsa 123", addressLocality: "Trujillo" });
    expect(data.priceRange).toMatch(/15\.00.+25\.00/);
    expect(data.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "10:00", closes: "14:00" },
    ]);
    expect(data.hasOfferCatalog?.itemListElement[0]).toMatchObject({ price: "25.00", priceCurrency: "PEN" });
  });

  it("sin datos solo lleva los campos base", () => {
    const data = shopJsonLd({ url, contact: {}, services: [], weeklyHours: [] });
    expect(Object.keys(data)).toEqual(["@context", "@type", "name", "url", "currenciesAccepted"]);
  });

  it("escapa < para no cerrar el script", () => {
    const data = shopJsonLd({ url, contact: {}, services: [{ name: "</script><b>", priceCents: 100 }], weeklyHours: [] });
    expect(jsonLdHtml(data)).not.toContain("</script");
  });
});
