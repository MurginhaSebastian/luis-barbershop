import { describe, expect, test } from "vitest";
import { parseBookingForm, slotQuerySchema } from "./booking-schema";

const BARBER = "10000000-0000-4000-8000-000000000001";
const CORTE = "20000000-0000-4000-8000-000000000001";
const CERA = "30000000-0000-4000-8000-000000000001";

function form(fields: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of fields) f.append(k, v);
  return f;
}

const valid: [string, string][] = [
  ["barberId", BARBER],
  ["serviceIds", CORTE],
  ["name", "  Cliente Prueba "],
  ["phone", "900 000-001"],
  ["start", "2026-11-02T15:00:00.000Z"],
  [`qty:${CERA}`, "2"],
  ["qty:30000000-0000-4000-8000-000000000002", "0"],
];

describe("parseBookingForm", () => {
  test("acepta un formulario válido y lo deja listo para el caso de uso", () => {
    const r = parseBookingForm(form(valid));
    expect(r.success && r.data).toEqual({
      barberId: BARBER,
      serviceIds: [CORTE],
      products: [{ productId: CERA, quantity: 2 }],
      name: "Cliente Prueba",
      phone: "900000001",
      start: new Date("2026-11-02T15:00:00.000Z"),
    });
  });

  test.each([
    ["teléfono que no es celular", "phone", "12345"],
    ["id manipulado", "barberId", "1 OR 1=1"],
    ["fecha basura", "start", "mañana"],
    ["nombre vacío", "name", " "],
  ])("rechaza %s", (_, field, value) => {
    const fields = valid.map(([k, v]) => [k, k === field ? value : v] as [string, string]);
    const r = parseBookingForm(form(fields));
    expect(r.success).toBe(false);
  });

  test("exige al menos un servicio", () => {
    expect(parseBookingForm(form(valid.filter(([k]) => k !== "serviceIds"))).success).toBe(false);
  });
});

describe("slotQuerySchema", () => {
  test("acepta uno o varios servicios en la URL", () => {
    expect(slotQuerySchema.safeParse({ servicios: CORTE, barbero: BARBER, dia: "2026-11-02" }).success).toBe(true);
    expect(slotQuerySchema.safeParse({ servicios: [CORTE, CORTE], barbero: BARBER, dia: "2026-11-02" }).success).toBe(true);
    expect(slotQuerySchema.safeParse({ barbero: BARBER, dia: "2026-11-02" }).success).toBe(false);
    expect(slotQuerySchema.safeParse({ servicios: CORTE, barbero: BARBER, dia: "02/11/2026" }).success).toBe(false);
  });
});
