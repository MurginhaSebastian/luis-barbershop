import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MessageOutcome } from "@/application/ports/assistant";
import type { ConversationTurn } from "@/application/ports/repositories/conversation-repository";
import type { ToolCall, ToolContext, ToolResult } from "@/application/use-cases/assistant/bot-tool-executor";
import { DEFAULT_SITE_SETTINGS } from "@/core/entities/site";
import { GroqAssistant } from "./groq-assistant";

const NOW = new Date("2026-11-16T15:30:00-05:00");
const ME = "51900000001";
const message = (text: string) => ({ id: "wamid.1", from: ME, text });
const call = (id: string, name: string, args: unknown = {}) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const groq = (msg: Record<string, unknown>) => new Response(JSON.stringify({ choices: [{ message: msg }] }), { status: 200 });

const RESULTS: Record<string, ToolResult> = {
  listar_catalogo_y_mis_citas: { ok: true, data: { services: [{ id: "s1", name: "Corte" }], myActiveAppointments: [] } },
  consultar_huecos_dinamicos: { ok: true, data: { totalDurationMinutes: 30, slots: [{ startTime: "2026-11-17T17:00:00-05:00" }] } },
  reservar_cita: {
    ok: true,
    data: { appointment: { when: "mar, 17 nov, 17:00", barberName: "Luis" }, next: "Quedó pendiente: 35 minutos antes le escribiremos." },
    failedNotices: 1,
  },
};

function makeAssistant(responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    const next = queue.shift() ?? groq({ content: "fin" });
    if (next instanceof Error) throw next;
    return next;
  });
  const executeTool = vi.fn<(c: ToolCall, ctx: ToolContext) => Promise<ToolResult>>(async (c) => RESULTS[c.name] ?? { ok: true, data: {} });
  const history: ConversationTurn[] = [];
  const conversations = {
    recent: vi.fn(async () => [...history]),
    append: vi.fn(async (_phone: string, turns: readonly ConversationTurn[]) => void history.push(...turns)),
  };
  const sendText = vi.fn<(phone: string, text: string) => Promise<void>>(async () => {});
  const fallback = { handleMessage: vi.fn<() => Promise<MessageOutcome>>(async () => ({ kind: "no-code" })) };
  const assistant = new GroqAssistant({
    apiKey: "gsk_prueba",
    model: "openai/gpt-oss-120b",
    tools: { executeTool },
    conversations,
    messaging: { sendText, sendTemplate: async () => {} },
    siteSettings: { get: async () => ({ ...DEFAULT_SITE_SETTINGS, contact: { whatsapp: "51900000000" } }), save: async () => {} },
    fallback,
    now: () => NOW,
    fetchImpl,
  });
  const bodies = () => fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
  return { assistant, fetchImpl, executeTool, conversations, history, sendText, fallback, bodies };
}

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("varias rondas de herramientas", () => {
  test("catálogo → huecos → reservar → respuesta, siempre con el celular de quien escribe", async () => {
    const t = makeAssistant([
      groq({ tool_calls: [call("c1", "listar_catalogo_y_mis_citas")] }),
      groq({ tool_calls: [call("c2", "consultar_huecos_dinamicos", { serviceIds: ["s1"], date: "2026-11-17" })] }),
      groq({ tool_calls: [call("c3", "reservar_cita", { customerName: "Sebastián", serviceIds: ["s1"], startTime: "2026-11-17T17:00:00-05:00" })] }),
      groq({ content: "¡Listo, Sebastián! Tu corte quedó para mañana a las 17:00." }),
    ]);
    expect(await t.assistant.handleMessage(message("Corte mañana a las 5 pm, soy Sebastián"))).toEqual({ kind: "answered" });

    expect(t.executeTool.mock.calls.map(([c]) => c.name)).toEqual(["listar_catalogo_y_mis_citas", "consultar_huecos_dinamicos", "reservar_cita"]);
    for (const [, context] of t.executeTool.mock.calls) expect(context).toEqual({ verifiedPhone: ME, now: NOW });
    expect(t.sendText).toHaveBeenCalledWith(ME, "¡Listo, Sebastián! Tu corte quedó para mañana a las 17:00.");

    const bodies = t.bodies();
    expect(bodies).toHaveLength(4);
    expect(bodies[0]).toMatchObject({ model: "openai/gpt-oss-120b", tool_choice: "auto" });
    expect(bodies[0].tools.map((tool: { function: { name: string } }) => tool.function.name)).toContain("reservar_cita");
    // El resultado vuelve al modelo con su id de llamada y sin los avisos fallidos, que se registran aparte.
    const toolMessage = bodies[3].messages.find((m: { tool_call_id?: string }) => m.tool_call_id === "c3");
    expect(JSON.parse(toolMessage.content)).toEqual({ ok: true, data: RESULTS.reservar_cita.ok && RESULTS.reservar_cita.data });
    expect(warn).toHaveBeenCalledWith("asistente de IA: avisos que no salieron", { tool: "reservar_cita", failedNotices: 1, phone: "…001" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(ME);
    expect(t.history).toEqual([
      { role: "user", content: "Corte mañana a las 5 pm, soy Sebastián" },
      { role: "assistant", content: "¡Listo, Sebastián! Tu corte quedó para mañana a las 17:00." },
    ]);
  });

  test("el prompt prohíbe decir confirmada si quedó pendiente, y la negrita sale en formato WhatsApp", async () => {
    const t = makeAssistant([groq({ content: "Tu cita de **Fade** con **Luis**" })]);
    await t.assistant.handleMessage(message("hola"));
    expect(t.bodies()[0].messages[0].content).toContain("no digas que está confirmada");
    expect(t.sendText).toHaveBeenCalledWith(ME, "Tu cita de *Fade* con *Luis*");
    expect(t.history.at(-1)).toEqual({ role: "assistant", content: "Tu cita de *Fade* con *Luis*" });
  });

  test("como mucho 3 rondas: si el modelo sigue pidiendo herramientas, no se ejecutan más", async () => {
    const always = () => groq({ tool_calls: [call("c", "listar_catalogo_y_mis_citas")] });
    const t = makeAssistant([always(), always(), always(), always(), always()]);
    await t.assistant.handleMessage(message("hola"));
    expect(t.executeTool).toHaveBeenCalledTimes(3);
    expect(t.fetchImpl).toHaveBeenCalledTimes(4);
    expect(t.bodies()[3]).not.toHaveProperty("tools"); // la última petición, sin herramientas
    // Sin respuesta en texto y sin nada hecho: responde el asistente básico.
    expect(t.fallback.handleMessage).toHaveBeenCalled();
  });

  test("argumentos vacíos son {} y los mal formados vuelven al modelo como error, sin ejecutar nada", async () => {
    const t = makeAssistant([
      groq({ tool_calls: [{ id: "c1", type: "function", function: { name: "listar_catalogo_y_mis_citas", arguments: "" } }] }),
      groq({ tool_calls: [{ id: "c2", type: "function", function: { name: "reservar_cita", arguments: "{roto" } }] }),
      groq({ content: "¿Me repites la hora?" }),
    ]);
    await t.assistant.handleMessage(message("quiero reservar"));
    expect(t.executeTool).toHaveBeenCalledTimes(1);
    expect(t.executeTool.mock.calls[0][0]).toEqual({ name: "listar_catalogo_y_mis_citas", arguments: {} });
    const broken = t.bodies()[2].messages.find((m: { tool_call_id?: string }) => m.tool_call_id === "c2");
    expect(JSON.parse(broken.content)).toMatchObject({ ok: false, error: "INVALID_ARGUMENTS" });
  });
});

describe("contexto", () => {
  test("pasa los últimos 10 turnos de las 2 últimas horas, y el siguiente mensaje los recibe", async () => {
    const t = makeAssistant([groq({ content: "¿Para qué día?" }), groq({ content: "¿A qué hora?" })]);
    await t.assistant.handleMessage(message("Quiero corte y barba"));
    await t.assistant.handleMessage(message("mañana"));
    expect(t.conversations.recent).toHaveBeenCalledWith(ME, new Date(NOW.getTime() - 2 * 3600_000), 10);
    const second = t.bodies()[1].messages;
    expect(second.slice(1).map((m: { content: string }) => m.content)).toEqual(["Quiero corte y barba", "¿Para qué día?", "mañana"]);
  });

  test("el prompt fija fecha y hora de Lima, el alcance, cero inventos, la desambiguación y el contacto de Luis", async () => {
    const t = makeAssistant([groq({ content: "Solo atiendo las citas y consultas de Luis Barbershop." })]);
    await t.assistant.handleMessage(message("¿Me escribes un ensayo sobre la Revolución francesa?"));
    const system = t.bodies()[0].messages[0];
    expect(system.role).toBe("system");
    expect(system.content).toContain("16 de noviembre de 2026");
    expect(system.content).toContain("15:30");
    expect(system.content).toMatch(/Solo gestionas citas y consultas de Luis Barbershop.*cultura general/);
    expect(system.content).toContain("Nunca inventes servicios, precios, barberos ni horas libres");
    expect(system.content).toContain("MULTIPLE_APPOINTMENTS_FOUND");
    expect(system.content).toContain("+51900000000");
    // Un tema ajeno no ejecuta ninguna herramienta: solo la negativa breve.
    expect(t.executeTool).not.toHaveBeenCalled();
    expect(t.sendText).toHaveBeenCalledWith(ME, "Solo atiendo las citas y consultas de Luis Barbershop.");
  });

  test("un código o el botón del recordatorio van por el camino exacto, sin modelo", async () => {
    const t = makeAssistant([]);
    await t.assistant.handleMessage(message("Confirmo mi cita KRT482"));
    expect(t.fallback.handleMessage).toHaveBeenCalled();
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });
});

describe("si Groq falla", () => {
  test.each([
    ["sin red o timeout", new Error("The operation was aborted due to timeout")],
    ["límite de uso (429)", new Response('{"error":{"message":"rate limit"}}', { status: 429 })],
    ["error del servidor (503)", new Response("caído", { status: 503 })],
    ["respuesta inesperada", new Response('{"nada":true}', { status: 200 })],
  ])("%s: responde el asistente básico, sin colgar ni lanzar", async (_, failure) => {
    const t = makeAssistant([failure]);
    expect(await t.assistant.handleMessage(message("¿tienen hora el sábado?"))).toEqual({ kind: "no-code" });
    expect(t.fallback.handleMessage).toHaveBeenCalled();
    expect(t.sendText).not.toHaveBeenCalled();
  });

  test("si ya reservó, le confirma la reserva en vez de las instrucciones de siempre", async () => {
    const t = makeAssistant([
      groq({ tool_calls: [call("c1", "reservar_cita", { customerName: "Ana", serviceIds: ["s1"], startTime: "2026-11-17T17:00:00-05:00" })] }),
      new Response("caído", { status: 500 }),
    ]);
    expect(await t.assistant.handleMessage(message("reserva mañana 5 pm"))).toEqual({ kind: "answered" });
    expect(t.fallback.handleMessage).not.toHaveBeenCalled();
    expect(t.sendText.mock.calls[0][1]).toMatch(/^Listo: tu cita del mar, 17 nov, 17:00 con Luis quedó registrada\..*\+51900000000/);
  });

  test("si ya reservó y la respuesta no sale, no lanza: un reintento podría reservar otra hora", async () => {
    const t = makeAssistant([
      groq({ tool_calls: [call("c1", "reservar_cita", { customerName: "Ana", serviceIds: ["s1"], startTime: "2026-11-17T17:00:00-05:00" })] }),
      groq({ content: "Reservado." }),
    ]);
    t.sendText.mockRejectedValueOnce(new Error("WhatsApp caído"));
    await expect(t.assistant.handleMessage(message("reserva"))).resolves.toEqual({ kind: "answered" });
    expect(error).toHaveBeenCalled();
  });

  test("sin nada hecho, si la respuesta no sale se lanza para que Meta reintente", async () => {
    const t = makeAssistant([groq({ content: "Hola" })]);
    t.sendText.mockRejectedValueOnce(new Error("WhatsApp caído"));
    await expect(t.assistant.handleMessage(message("hola"))).rejects.toThrow("WhatsApp caído");
  });
});
