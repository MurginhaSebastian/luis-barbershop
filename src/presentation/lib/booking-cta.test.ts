import { describe, expect, it } from "vitest";
import { bookingCta } from "./booking-cta";

describe("bookingCta", () => {
  it("sin asistente lleva a la web", () => {
    expect(bookingCta(null)).toEqual({ href: "/reservar", external: false });
    expect(bookingCta(undefined, { webHref: "/reservar?servicios=x" })).toEqual({ href: "/reservar?servicios=x", external: false });
  });

  it("con asistente lleva a su WhatsApp con el texto", () => {
    expect(bookingCta("51900000000")).toEqual({
      href: "https://wa.me/51900000000?text=Hola%2C%20quiero%20reservar%20una%20cita",
      external: true,
    });
    const { href } = bookingCta("51900000000", { text: "Hola, quiero reservar un Corte", webHref: "/reservar?servicios=x" });
    expect(href).toBe("https://wa.me/51900000000?text=Hola%2C%20quiero%20reservar%20un%20Corte");
  });
});
