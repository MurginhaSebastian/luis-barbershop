import { describe, expect, test } from "vitest";
import { cleanModelText } from "./clean-model-text";

const GOOD =
  "¡Perfecto! El servicio “Desvanecido” (Fade) dura 45 min y cuesta S/ 35.\n\nPara este sábado (28/11) tengo los siguientes horarios disponibles en la tarde (después de la pausa de 14:00):\n\n15:00, 15:30, 16:00.\n\n¿Con cuál te quedas?";

// Salida real de la demo (turno 2), recortada.
const JUNK =
  "¿Quieres ? ? ? ? ? ... ? ?\n\n\n\n¡    \n\n\n\nOops! Parece…  \n\n\n\n  \n\n\n\nSorry…  \n\n\n\n… \n\n\n\n... \n\n\n\n... … \n\n\n\n... ...\n\n\n\nSorry… \n\n\n\n... ";

describe("cleanModelText", () => {
  test("la salida basura de la demo queda desde ¡Perfecto!", () => {
    expect(cleanModelText(JUNK + GOOD)).toBe(GOOD);
  });

  test.each([
    "- Fade 45 min S/ 35.00\n- Corte 30 min S/ 25.00",
    "¡Listo! 💈",
    "👍",
    "¿Te sirve?",
    "Tengo 15:00, 15:30 y 17:00... ¿cuál prefieres?",
    "Primera línea\n\nSegunda línea",
  ])("una respuesta normal no se toca: %s", (text) => {
    expect(cleanModelText(text)).toBe(text);
  });

  test("tres o más saltos de línea quedan en dos", () => {
    expect(cleanModelText("Hola\n\n\n\nChao")).toBe("Hola\n\nChao");
  });

  test("solo relleno: queda vacío", () => {
    expect(cleanModelText("? ? ?\n\n...\n\nSorry…")).toBe("");
  });
});
