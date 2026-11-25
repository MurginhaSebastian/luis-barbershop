/** Con letra, cifra o emoji: lo que distingue una línea con contenido de una de puro relleno ("¡", "... …"). */
const CONTENT = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
/** Muletillas que el modelo suelta a veces: "Oops! Parece…", "Sorry…". */
const FILLER_LINE = /^\W*(oops|sorry)\b/i;
/** "¿Quieres ? ? ? ?": tres o más signos sueltos seguidos. */
const QUESTION_RUN = /(?:\?\s+){3,}/;
const LEADING_JUNK = /^(?:[\s?]|\.{2,}|…)+/;

/** Quita el relleno basura que el modelo a veces antepone a su respuesta. Si no queda nada, devuelve "". */
export function cleanModelText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .filter((line) => line === "" || (CONTENT.test(line) && !QUESTION_RUN.test(line + " ") && !(FILLER_LINE.test(line) && line.length <= 40)))
    .join("\n")
    .replace(LEADING_JUNK, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
