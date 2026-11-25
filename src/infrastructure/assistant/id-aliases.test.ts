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
});
