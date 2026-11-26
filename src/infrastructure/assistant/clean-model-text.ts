/** Con letra, cifra o emoji: lo que distingue una línea con contenido de una de puro relleno ("¡", "... …"). */
const CONTENT = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
/** Muletillas que el modelo suelta a veces: "Oops! Parece…", "Sorry…". */
const FILLER_LINE = /^\W*(oops|sorry)\b/i;
/** "¿Quieres ? ? ? ?": tres o más signos sueltos seguidos. */
const QUESTION_RUN = /(?:\?\s+){3,}/;
const LEADING_JUNK = /^(?:[\s?]|\.{2,}|…)+/;
/** Instrucciones de formato copiadas del prompt: "(una por línea)", "(ver slots)", "(startTime)". */
const FORMAT_HINT = /[ \t]*\([^()\n]*\b(?:por l[ií]nea|slots?|starttimes?|herramientas?)\b[^()\n]*\)/gi;

/** Caracteres invisibles y asteriscos de negrita sin texto: basura del modelo. */
const INVISIBLE = /[​-‍⁠﻿]/g;
const EMPTY_BOLD = /(^|\s)\*{1,2}(?=\s*[?!.,]|\s*$)/gm;

/** Quita el relleno basura que el modelo a veces antepone a su respuesta. Si no queda nada, devuelve "". */
export function cleanModelText(text: string): string {
  return text
    .replace(INVISIBLE, "")
    .replace(EMPTY_BOLD, "$1")
    .replace(FORMAT_HINT, "")
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .filter((line) => line === "" || (CONTENT.test(line) && !QUESTION_RUN.test(line + " ") && !(FILLER_LINE.test(line) && line.length <= 40)))
    .join("\n")
    .replace(LEADING_JUNK, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
