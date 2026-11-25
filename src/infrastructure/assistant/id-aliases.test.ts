import { describe, expect, test } from "vitest";
import { IdAliases } from "./id-aliases";

const SERVICE = "00000000-0000-4000-8000-000000000001";
const BARBER = "00000000-0000-4000-8000-000000000101";
const APPOINTMENT = "00000000-0000-4000-8000-000000000201";

describe("IdAliases", () => {
  test("registra alias estables por tipo y los reconoce al codificar y decodificar", () => {
    const a = new IdAliases();
    expect(a.register("s", SERVICE)).toBe("s1");
    expect(a.register("b", BARBER)).toBe("b1");
    expect(a.register("s", SERVICE)).toBe("s1");
    expect(a.encode({ services: [{ id: SERVICE }], barberId: BARBER, date: "2026-11-17" })).toEqual({ services: [{ id: "s1" }], barberId: "b1", date: "2026-11-17" });
    expect(a.decode({ serviceIds: ["s1"], barberId: "b1", customerName: "s2" })).toEqual({ serviceIds: [SERVICE], barberId: BARBER, customerName: "s2" });
  });

  test("un uuid nuevo (una cita) recibe alias a1 y vuelve a su id real", () => {
    const a = new IdAliases();
    expect(a.encode({ myActiveAppointments: [{ id: APPOINTMENT }], x: null, n: 3 })).toEqual({ myActiveAppointments: [{ id: "a1" }], x: null, n: 3 });
    expect(a.decode({ appointmentId: "a1" })).toEqual({ appointmentId: APPOINTMENT });
  });

  test("un alias inventado no se traduce: el validador lo rechaza", () => {
    expect(new IdAliases().decode({ appointmentId: "a9" })).toEqual({ appointmentId: "a9" });
  });

  test("strip quita los alias conocidos que el modelo deja ver, y nada más", () => {
    const a = new IdAliases();
    a.register("b", BARBER);
    a.register("b", "00000000-0000-4000-8000-000000000102");
    a.register("b", "00000000-0000-4000-8000-000000000103");
    a.register("s", SERVICE);
    expect(a.strip("Puedes elegir a Luis (b3), al Barbero invitado (b1) o a Ana [b2].")).toBe("Puedes elegir a Luis, al Barbero invitado o a Ana.");
    expect(a.strip("Con Luis (id b3) y Ana id=b2 o Pedro b1, el Fade (s1) sale S/ 35")).toBe("Con Luis y Ana o Pedro, el Fade sale S/ 35");
    const normal = "Fade de 60 min a S/ 35, hoy a las 3:00 y a las b9 o la tienda s1:30 con la sala b2.5";
    expect(a.strip(normal)).toBe(normal);
    expect(new IdAliases().strip("Luis (b3)")).toBe("Luis (b3)");
  });
});
