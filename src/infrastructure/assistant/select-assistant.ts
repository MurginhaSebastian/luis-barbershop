import type { AiAssistantPort } from "@/application/ports/assistant";
import type { IMessagingService } from "@/application/ports/messaging";
import type { IConversationRepository } from "@/application/ports/repositories/conversation-repository";
import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import type { BotToolExecutor } from "@/application/use-cases/assistant/bot-tool-executor";
import { DEFAULT_GROQ_MODEL, GroqAssistant } from "./groq-assistant";

export interface AssistantDeps {
  /** El asistente básico (código y palabras clave). */
  fallback: AiAssistantPort;
  tools: Pick<BotToolExecutor, "executeTool">;
  conversations: IConversationRepository;
  messaging: IMessagingService | null;
  siteSettings: ISiteSettingsRepository;
  now: () => Date;
  siteUrl?: string;
}

let warned = false;

/** El asistente de IA está activo (WhatsApp aparte): sin él, el número automático solo confirma o cancela. */
export const aiAssistantEnabled = (env: Record<string, string | undefined>): boolean => env.AI_PROVIDER === "groq" && !!env.GROQ_API_KEY;

/**
 * Quién atiende el texto libre de WhatsApp. Sin AI_PROVIDER, el asistente básico. Con AI_PROVIDER=groq,
 * GROQ_API_KEY y WhatsApp configurado, el de IA (modelo en AI_MODEL). Cualquier otra combinación no rompe nada
 * (esto se construye en cada petición, también al reservar): avisa una vez y usa el básico.
 */
export function selectAssistant(env: Record<string, string | undefined>, deps: AssistantDeps): AiAssistantPort {
  const provider = env.AI_PROVIDER;
  if (!provider) return deps.fallback;
  if (aiAssistantEnabled(env) && deps.messaging) {
    return new GroqAssistant({ ...deps, messaging: deps.messaging, apiKey: env.GROQ_API_KEY!, model: env.AI_MODEL || DEFAULT_GROQ_MODEL });
  }
  if (!warned) {
    warned = true;
    console.warn(`AI_PROVIDER=${provider}: falta GROQ_API_KEY o WhatsApp, o el proveedor no existe; se usa el asistente básico.`);
  }
  return deps.fallback;
}
