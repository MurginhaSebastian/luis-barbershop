import { describe, expect, test } from "vitest";
import { InvalidSettingsError } from "../errors/domain-errors";
import { assertValidContact, DEFAULT_SITE_SETTINGS, readSiteSettings } from "./site";

describe("assertValidContact", () => {
  test("acepta un contacto completo y uno vacío", () => {
    expect(() =>
      assertValidContact({
        whatsapp: "51900000000",
        address: "Av. Ejemplo 123",
        mapsUrl: "https://maps.google.com/?q=Lima",
        instagramUrl: "https://instagram.com/ejemplo",
        complaintsUrl: "https://reclamos.example.pe",
      }),
    ).not.toThrow();
    expect(() => assertValidContact({})).not.toThrow();
  });

  test.each([
    ["javascript:", { mapsUrl: "javascript:alert(1)" }],
    ["JavaScript en mayúsculas", { instagramUrl: "JAVASCRIPT:alert(1)" }],
    ["data:", { facebookUrl: "data:text/html,<script>alert(1)</script>" }],
    ["http sin cifrar", { tiktokUrl: "http://tiktok.com/ejemplo" }],
    ["texto que no es enlace", { complaintsUrl: "mi libro" }],
    ["enlace enorme", { mapsUrl: `https://x.pe/${"a".repeat(500)}` }],
  ])("rechaza un enlace %s", (_, contact) => {
    expect(() => assertValidContact(contact)).toThrow(InvalidSettingsError);
  });

  test.each(["900000000", "5190000000", "51800000000x", "+51900000000"])("rechaza el WhatsApp %j", (whatsapp) => {
    expect(() => assertValidContact({ whatsapp })).toThrow(InvalidSettingsError);
  });

  test("rechaza una dirección vacía o enorme", () => {
    expect(() => assertValidContact({ address: "  " })).toThrow(InvalidSettingsError);
    expect(() => assertValidContact({ address: "x".repeat(201) })).toThrow(InvalidSettingsError);
  });
});

describe("readSiteSettings", () => {
  test("sin nada guardado devuelve los valores por defecto", () => {
    expect(readSiteSettings(undefined)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(readSiteSettings("basura")).toEqual(DEFAULT_SITE_SETTINGS);
  });

  test("completa lo que falte y descarta lo desconocido", () => {
    const settings = readSiteSettings({
      contact: { whatsapp: "51900000000", otro: 5 },
      sections: { products: false, inventada: true },
      images: { hero: "/imagenes/a.webp", raro: "/x" },
    });
    expect(settings.contact).toEqual({ whatsapp: "51900000000" });
    expect(settings.sections).toEqual({ ...DEFAULT_SITE_SETTINGS.sections, products: false });
    expect(settings.images).toEqual({ hero: "/imagenes/a.webp" });
  });

  test("un contacto inválido guardado no llega a la web", () => {
    const settings = readSiteSettings({ contact: { mapsUrl: "javascript:alert(1)" }, sections: { about: false } });
    expect(settings.contact).toEqual({});
    expect(settings.sections.about).toBe(false);
  });
});
