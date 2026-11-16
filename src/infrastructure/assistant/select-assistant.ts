import type { AiAssistantPort } from "@/application/ports/assistant";

let warned = false;

/**
 * Quién atiende el texto libre de WhatsApp. Sin AI_PROVIDER, el asistente básico: código y palabras clave.
 * Aquí entrará el adaptador del LLM (Groq / Claude Haiku), construido con BotToolExecutor. Un AI_PROVIDER aún sin
 * adaptador no rompe nada (esto se construye en cada petición, también al reservar): avisa y usa el básico.
 */
export function selectAssistant(env: Record<string, string | undefined>, fallback: AiAssistantPort): AiAssistantPort {
  if (env.AI_PROVIDER && !warned) {
    warned = true;
    console.warn(`AI_PROVIDER=${env.AI_PROVIDER}: aún no hay adaptador de IA; se usa el asistente básico.`);
  }
  return fallback;
}
