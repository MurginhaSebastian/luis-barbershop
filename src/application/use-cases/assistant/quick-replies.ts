export type QuickReplyKind = "human" | "greeting" | "nonsense";

/** Un solo sitio para el texto que deriva al cliente con el barbero. */
export function humanHandoffText(whatsapp: string): string {
  return `Hola, si quieres contactarte directamente con el barbero, escríbele a este número: +${whatsapp} (https://wa.me/${whatsapp.replace(/\D/g, "")}) y con gusto te atenderá.`;
}

const plain = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

// "dueño" y "encargado" solo cuentan con un verbo de contacto: "¿el dueño atiende hoy?" es una consulta normal.
const ASK_FOR_PERSON = /\b(hablar|conversar|comunicar\w*|contactar\w*)\b.{0,30}\b(luis|barbero|dueno|persona|alguien|humano|encargado)\b/;
const HUMAN = /\b(humano|persona real|reclamos?|quejas?)\b/;
const GREETING_WORDS = new Set(
  "hola ola holi holis buenas buenos buen dia dias tarde tardes noche noches mano oe oye que tal hey alo saludos como estas esta hi hello".split(" "),
);

/** Mensajes que se contestan con un texto fijo, sin gastar Groq. */
export function quickReplyKind(text: string): QuickReplyKind | null {
  const t = plain(text);
  if (ASK_FOR_PERSON.test(t) || HUMAN.test(t)) return "human";
  if (!/[\p{L}\p{N}]/u.test(t) || /^[^\p{L}\p{N}]*\p{L}[^\p{L}\p{N}]*$/u.test(t)) return "nonsense";
  // Letras repetidas ("holaaa", "buenass") cuentan como una.
  const words = t.replace(/(\p{L})\1+/gu, "$1").split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length > 0 && words.every((w) => GREETING_WORDS.has(w)) && !/\p{N}/u.test(t)) return "greeting";
  return null;
}
