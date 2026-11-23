import { SHOP_NAME } from "@/core/entities/site";

export type QuickReplyKind = "offtopic" | "human" | "greeting" | "nonsense";

/** La frase fija ante desvíos: la usan el prompt (regla 1) y la respuesta sin modelo. */
export const OFFTOPIC_REPLY = "Solo puedo ayudarte con citas, horarios y servicios de " + SHOP_NAME + ".";

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
// Trato de confianza ("vecino", "jefe"): solo, es un saludo.
const GREETING_WORDS = new Set(
  ("hola ola holi holis buenas buenos buen dia dias tarde tardes noche noches mano oe oye que tal hey alo saludos como estas esta hi hello " +
    "vecino vecina causa hermano hermana hermanito bro pata compadre compa jefe jefecito maestro amigo amiga tio crack").split(" "),
);
// Desvíos evidentes ("ignora tus instrucciones", "modo desarrollador"). "olvidé mi cita" no entra: exige "olvida" + reglas.
const OFFTOPIC =
  /\b(ignora|olvida)\b.{0,30}\b(instrucciones|reglas|prompt|indicaciones)\b|\bprompt\b|\binstrucciones del sistema\b|\bmodo (desarrollador|dios|dan)\b|\bjailbreak\b|\bactua como\b|\bfinge (ser|que)\b|\beres ahora\b/;

/** Mensajes que se contestan con un texto fijo, sin gastar Groq. */
export function quickReplyKind(text: string): QuickReplyKind | null {
  const t = plain(text);
  if (OFFTOPIC.test(t)) return "offtopic";
  if (ASK_FOR_PERSON.test(t) || HUMAN.test(t)) return "human";
  if (!/[\p{L}\p{N}]/u.test(t) || /^[^\p{L}\p{N}]*\p{L}[^\p{L}\p{N}]*$/u.test(t)) return "nonsense";
  // Letras repetidas ("holaaa", "buenass") cuentan como una.
  const words = t.replace(/(\p{L})\1+/gu, "$1").split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length > 0 && words.every((w) => GREETING_WORDS.has(w)) && !/\p{N}/u.test(t)) return "greeting";
  return null;
}
