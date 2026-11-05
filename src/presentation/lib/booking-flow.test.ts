import { describe, expect, test } from "vitest";
import { bookingHref, resolveStep } from "./booking-flow";

const full = { servicios: ["s1"], barbero: "b1", dia: "2026-11-02", hora: "2026-11-02T15:00:00.000Z" };

describe("resolveStep", () => {
  test("sin paso pedido empieza en el 1, aunque haya servicios marcados desde la portada", () => {
    expect(resolveStep(undefined, { servicios: ["s1"] })).toBe(1);
  });

  test("respeta el paso pedido si tiene sus datos y deja volver atrás", () => {
    expect(resolveStep(4, full)).toBe(4);
    expect(resolveStep(2, full)).toBe(2);
  });

  test("una URL manipulada cae en el primer paso incompleto", () => {
    expect(resolveStep(4, { servicios: [] })).toBe(1);
    expect(resolveStep(4, { servicios: ["s1"] })).toBe(2);
    expect(resolveStep(4, { servicios: ["s1"], barbero: "b1" })).toBe(3);
    expect(resolveStep(4, { servicios: ["s1"], barbero: "b1", dia: "2026-11-02" })).toBe(3);
  });
});

describe("bookingHref", () => {
  test("repite los servicios y omite lo que falta", () => {
    expect(bookingHref(2, { servicios: ["a", "b"] })).toBe("/reservar?paso=2&servicios=a&servicios=b");
  });

  test("escapa la hora para que sobreviva en la URL", () => {
    const url = new URL(bookingHref(4, full), "http://x");
    expect(url.searchParams.get("hora")).toBe(full.hora);
  });
});
