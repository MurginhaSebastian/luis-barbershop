import { z } from "zod";
import type { AiAssistantPort, IncomingMessage, MessageOutcome } from "@/application/ports/assistant";
import type { IMessagingService } from "@/application/ports/messaging";
import type { IConversationRepository } from "@/application/ports/repositories/conversation-repository";
import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import type { BotToolExecutor, ToolResult } from "@/application/use-cases/assistant/bot-tool-executor";
import { botToolDefinitions } from "@/application/use-cases/assistant/bot-tools";
import { codeInMessage } from "@/core/entities/confirmation";
import { normalizePhone } from "@/core/entities/customer";
import { shopDateOf } from "@/core/scheduling/availability";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/** llama-3.3-70b-versatile se retiró el 16-ago-2026 (salvo contratos empresariales); este es su reemplazo. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ROUNDS = 3;
const HISTORY_TURNS = 10;
const HISTORY_WINDOW_MS = 2 * 60 * 60_000;
/** Tiempo total para todas las rondas: el webhook no puede quedarse colgado. */
const TIMEOUT_MS = 12_000;
const MUTATING = new Set(["reservar_cita", "confirmar_asistencia", "cancelar_cita"]);

export interface GroqAssistantDeps {
  apiKey: string;
  model: string;
  tools: Pick<BotToolExecutor, "executeTool">;
  conversations: IConversationRepository;
  messaging: IMessagingService;
  siteSettings: ISiteSettingsRepository;
  /** El asistente básico: atiende los códigos y responde cuando Groq no puede. */
  fallback: AiAssistantPort;
  now: () => Date;
  fetchImpl?: typeof fetch;
}

/** Groq no respondió a tiempo o respondió algo inservible: se cae al asistente básico. */
class AssistantUnavailableError extends Error {}

type ChatMessage = Record<string, unknown>;
type Mutation = { tool: string; data: unknown };

const completion = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(z.object({ id: z.string(), function: z.object({ name: z.string(), arguments: z.string().nullish() }) }))
            .nullish(),
        }),
      }),
    )
    .min(1),
});

/** Para los registros: solo los 3 últimos dígitos del celular. */
const mask = (phone: string) => `…${phone.slice(-3)}`;

const limaNow = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function systemPrompt(now: Date, contact: string | undefined): string {
  const luis = contact ? `el WhatsApp de Luis: +${contact}` : "que hable directamente con la barbería";
  return [
    "Eres el asistente virtual de reservas de Luis Barbershop, una barbería en Trujillo (Perú). Atiendes por WhatsApp.",
    `Ahora en Perú es ${limaNow.format(now)} (fecha ${shopDateOf(now)}, zona America/Lima, UTC−5).`,
    "Reglas:",
    "1. Solo gestionas citas y consultas de Luis Barbershop: servicios, precios, barberos, horarios, reservar, confirmar y cancelar. Si te piden cualquier otra cosa (cultura general, tareas, programación, redacción u otros temas), responde en una frase que solo atiendes las citas y consultas de la barbería.",
    "2. Nunca inventes servicios, precios, barberos ni horas libres: consúltalos siempre con listar_catalogo_y_mis_citas y consultar_huecos_dinamicos antes de decirlos. Para reservar usa exactamente un startTime que haya devuelto consultar_huecos_dinamicos.",
    "3. Antes de reservar, confirma con el cliente los servicios, el día, la hora, el barbero (o sin preferencia) y su nombre.",
    "4. Si confirmar_asistencia o cancelar_cita devuelve MULTIPLE_APPOINTMENTS_FOUND, pregunta a cuál de sus citas se refiere (día, hora y barbero) y vuelve a llamar con su appointmentId.",
    "5. Los ids de mensajes anteriores no los conservas: antes de usar un appointmentId o un serviceId, vuelve a llamar a listar_catalogo_y_mis_citas.",
    `6. Si el cliente tiene un reclamo o pide hablar con una persona, dale ${luis}.`,
    "7. Las herramientas ya saben quién escribe: nunca pidas ni uses otro número de celular.",
    "8. Responde en español, breve y cordial, en texto plano de WhatsApp (sin tablas ni markdown). Precios en soles (S/) y horas de Perú en formato 24 h.",
  ].join("\n");
}

/**
 * Asistente de IA con Groq (API compatible con OpenAI, por fetch). Usa las herramientas de BotToolExecutor
 * siempre con el celular del remitente firmado por Meta, recuerda las 2 últimas horas de la conversación y, si
 * Groq falla, cae al asistente básico sin dejar al cliente sin respuesta.
 */
export class GroqAssistant implements AiAssistantPort {
  private readonly tools = botToolDefinitions().map((d) => ({ type: "function", function: d }));

  constructor(private readonly deps: GroqAssistantDeps) {}

  async handleMessage(message: IncomingMessage): Promise<MessageOutcome> {
    // "Confirmo mi cita KRT482" o el botón del recordatorio: el camino exacto, sin modelo.
    if (codeInMessage(message.text)) return this.deps.fallback.handleMessage(message);

    const phone = normalizePhone(message.from);
    const now = this.deps.now();
    const { whatsapp } = (await this.deps.siteSettings.get()).contact;
    const done: Mutation[] = [];
    let reply: string;
    try {
      reply = await this.converse(phone, message.text, now, whatsapp, done);
    } catch (error) {
      // Sin nada hecho, un error de la base o de la app se relanza: el mensaje se libera y Meta reintenta.
      if (!(error instanceof AssistantUnavailableError) && done.length === 0) throw error;
      console.error("asistente de IA sin respuesta", { error: String(error), phone: mask(phone) });
      if (done.length === 0) return this.deps.fallback.handleMessage(message);
      // Ya reservó, confirmó o canceló: se le dice eso, no las instrucciones de siempre.
      reply = afterMutation(done.at(-1)!, whatsapp);
    }
    await this.deliver(phone, message.text, reply, now, done.length > 0);
    return { kind: "answered" };
  }

  private async converse(phone: string, text: string, now: Date, contact: string | undefined, done: Mutation[]): Promise<string> {
    const history = await this.deps.conversations.recent(phone, new Date(now.getTime() - HISTORY_WINDOW_MS), HISTORY_TURNS);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(now, contact) },
      ...history,
      { role: "user", content: text },
    ];
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    for (let round = 0; ; round++) {
      // Tras 3 rondas de herramientas, la última petición va sin herramientas: tiene que responder con texto.
      const withTools = round < MAX_TOOL_ROUNDS;
      const answer = await this.complete(messages, withTools, signal);
      const calls = answer.tool_calls ?? [];
      if (calls.length === 0 || !withTools) {
        if (calls.length > 0 || !answer.content?.trim()) throw new AssistantUnavailableError("sin respuesta en texto");
        return answer.content.trim();
      }
      messages.push({
        role: "assistant",
        ...(answer.content && { content: answer.content }),
        tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.function.name, arguments: c.function.arguments ?? "" } })),
      });
      for (const call of calls) {
        const result = await this.runTool(call.function.name, call.function.arguments, phone, now);
        if (result.ok && MUTATING.has(call.function.name)) done.push({ tool: call.function.name, data: result.data });
        messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
      }
    }
  }

  private async runTool(name: string, rawArgs: string | null | undefined, phone: string, now: Date): Promise<ToolResult> {
    let args: unknown;
    try {
      // La herramienta sin parámetros suele llegar con "".
      args = rawArgs?.trim() ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, error: "INVALID_ARGUMENTS", message: "Los argumentos no son JSON válido." };
    }
    const result = await this.deps.tools.executeTool({ name, arguments: args }, { verifiedPhone: phone, now });
    if (!result.ok || !result.failedNotices) return result;
    console.warn("asistente de IA: avisos que no salieron", { tool: name, failedNotices: result.failedNotices, phone: mask(phone) });
    // Al modelo no le sirve: la operación vale igual.
    return { ok: true, data: result.data };
  }

  private async complete(messages: ChatMessage[], withTools: boolean, signal: AbortSignal) {
    let response: Response;
    try {
      response = await (this.deps.fetchImpl ?? fetch)(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.deps.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.deps.model,
          messages,
          temperature: 0.2,
          ...(withTools && { tools: this.tools, tool_choice: "auto" }),
        }),
        signal,
      });
    } catch (error) {
      throw new AssistantUnavailableError(`Groq no respondió: ${String(error)}`);
    }
    // 429 (límite), 5xx o una clave mala: no se reintenta aquí, se cae al básico.
    if (!response.ok) throw new AssistantUnavailableError(`Groq ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const parsed = completion.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new AssistantUnavailableError("Groq devolvió una respuesta inesperada");
    return parsed.data.choices[0].message;
  }

  /** Responde y guarda el turno. Si ya cambió una cita, un fallo aquí no se relanza: un reintento podría repetirla. */
  private async deliver(phone: string, text: string, reply: string, now: Date, mutated: boolean) {
    try {
      await this.deps.messaging.sendText(phone, reply);
    } catch (error) {
      if (!mutated) throw error;
      console.error("asistente de IA: la respuesta no salió tras cambiar una cita", { error: String(error), phone: mask(phone) });
    }
    try {
      const turns = [
        { role: "user" as const, content: text },
        { role: "assistant" as const, content: reply },
      ];
      await this.deps.conversations.append(phone, turns, now, new Date(now.getTime() - HISTORY_WINDOW_MS));
    } catch (error) {
      console.error("asistente de IA: no se guardó el historial", { error: String(error), phone: mask(phone) });
    }
  }
}

/** Respuesta fija con lo último que se hizo, para cuando Groq falla después de reservar, confirmar o cancelar. */
function afterMutation(mutation: Mutation, contact: string | undefined): string {
  const data = mutation.data as { appointment?: { when?: string; barberName?: string }; next?: string };
  const when = data.appointment?.when ? ` del ${data.appointment.when}` : "";
  const ask = contact ? ` Si necesitas algo más, escribe a Luis al +${contact}.` : "";
  if (mutation.tool === "reservar_cita") {
    return `Listo: tu cita${when}${data.appointment?.barberName ? ` con ${data.appointment.barberName}` : ""} quedó registrada. ${data.next ?? ""}${ask}`.replace(/\s+/g, " ").trim();
  }
  if (mutation.tool === "cancelar_cita") return `Listo: tu cita quedó cancelada.${ask}`;
  return `Listo: tu cita${when} quedó confirmada.${ask}`;
}
