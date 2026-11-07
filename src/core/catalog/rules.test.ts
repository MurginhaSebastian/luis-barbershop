import { describe, expect, test } from "vitest";
import { InvalidCatalogError } from "../errors/domain-errors";
import { assertValidBarber, assertValidHours, assertValidProduct, assertValidService } from "./rules";

const service = { name: "Corte", durationMinutes: 30, priceCents: 3000 };

describe("servicios", () => {
  test("acepta un servicio normal y uno gratuito", () => {
    expect(() => assertValidService(service)).not.toThrow();
    expect(() => assertValidService({ ...service, priceCents: 0 })).not.toThrow();
  });

  test.each([
    ["nombre vacío", { name: "  " }],
    ["nombre de una letra", { name: "A" }],
    ["nombre demasiado largo", { name: "x".repeat(61) }],
    ["duración cero", { durationMinutes: 0 }],
    ["duración enorme", { durationMinutes: 241 }],
    ["duración que no va de 5 en 5", { durationMinutes: 32 }],
    ["duración con decimales", { durationMinutes: 30.5 }],
    ["precio negativo", { priceCents: -1 }],
    ["precio con decimales de céntimo", { priceCents: 10.5 }],
    ["precio absurdo", { priceCents: 100_000_01 }],
  ])("rechaza %s", (_, change) => {
    expect(() => assertValidService({ ...service, ...change })).toThrow(InvalidCatalogError);
  });
});

test("los productos validan nombre y precio", () => {
  expect(() => assertValidProduct({ name: "Cera", priceCents: 2500 })).not.toThrow();
  expect(() => assertValidProduct({ name: "", priceCents: 2500 })).toThrow(InvalidCatalogError);
  expect(() => assertValidProduct({ name: "Cera", priceCents: -5 })).toThrow(InvalidCatalogError);
});

test("los barberos necesitan nombre", () => {
  expect(() => assertValidBarber({ name: "Luis" })).not.toThrow();
  expect(() => assertValidBarber({ name: " " })).toThrow(InvalidCatalogError);
});

describe("horario de un día", () => {
  const tramo = (openMinute: number, closeMinute: number) => ({ openMinute, closeMinute });

  test("acepta un día cerrado, un tramo y una jornada partida", () => {
    expect(() => assertValidHours([])).not.toThrow();
    expect(() => assertValidHours([tramo(600, 840)])).not.toThrow();
    expect(() => assertValidHours([tramo(600, 840), tramo(900, 1200)])).not.toThrow();
  });

  test("dos tramos pueden tocarse y da igual el orden en que lleguen", () => {
    expect(() => assertValidHours([tramo(840, 1200), tramo(600, 840)])).not.toThrow();
  });

  test.each([
    ["cierra antes de abrir", [tramo(840, 600)]],
    ["abre y cierra a la vez", [tramo(600, 600)]],
    ["se sale del día", [tramo(600, 1441)]],
    ["empieza antes de medianoche", [tramo(-10, 600)]],
    ["tramos que se pisan", [tramo(600, 900), tramo(840, 1200)]],
    ["tramos repetidos", [tramo(600, 840), tramo(600, 840)]],
  ])("rechaza un horario que %s", (_, hours) => {
    expect(() => assertValidHours(hours)).toThrow(InvalidCatalogError);
  });
});
