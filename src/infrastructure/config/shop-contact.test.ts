import { afterEach, describe, expect, test, vi } from "vitest";
import { getShopContact } from "./shop-contact";

afterEach(() => vi.unstubAllEnvs());

describe("getShopContact", () => {
  test("normaliza el WhatsApp y acepta URLs válidas", () => {
    vi.stubEnv("SHOP_WHATSAPP", "+51 900 000 000");
    vi.stubEnv("SHOP_INSTAGRAM_URL", "https://instagram.com/ejemplo");
    expect(getShopContact()).toMatchObject({ whatsapp: "51900000000", instagramUrl: "https://instagram.com/ejemplo" });
  });

  test("lo vacío o inválido no se muestra en vez de romper la página", () => {
    vi.stubEnv("SHOP_WHATSAPP", "123");
    vi.stubEnv("SHOP_MAPS_URL", "no-es-url");
    vi.stubEnv("SHOP_ADDRESS", "");
    const c = getShopContact();
    expect(c.whatsapp).toBeUndefined();
    expect(c.mapsUrl).toBeUndefined();
    expect(c.address).toBeUndefined();
  });
});
