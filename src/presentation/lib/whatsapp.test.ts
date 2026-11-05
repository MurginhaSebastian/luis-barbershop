import { expect, test } from "vitest";
import { cancellationMessage, confirmationMessage, whatsappLink } from "./whatsapp";

const appointment = { customerName: "Pedro", barberName: "Luis", start: "2026-11-02T15:00:00.000Z" };

test("el mensaje de confirmación da fecha y hora de Lima, no UTC", () => {
  expect(confirmationMessage(appointment)).toBe(
    "Hola Pedro, tu cita en Luis Barbershop está confirmada: lunes, 2 de noviembre a las 10:00 con Luis. ¡Te esperamos!",
  );
});

test("el mensaje de cancelación propone buscar otra hora", () => {
  expect(cancellationMessage(appointment)).toContain("del lunes, 2 de noviembre a las 10:00");
});

test("el enlace escapa el texto para que llegue entero", () => {
  const url = new URL(whatsappLink("51900000001", "Hola & adiós?"));
  expect(url.pathname).toBe("/51900000001");
  expect(url.searchParams.get("text")).toBe("Hola & adiós?");
});
