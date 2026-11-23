import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MessageOutcome } from "@/application/ports/assistant";
import type { ConversationTurn } from "@/application/ports/repositories/conversation-repository";
import type { ToolCall, ToolContext, ToolResult } from "@/application/use-cases/assistant/bot-tool-executor";
import { DEFAULT_SITE_SETTINGS } from "@/core/entities/site";
import { humanHandoffText } from "@/application/use-cases/assistant/quick-replies";
import { MessageBatcher } from "@/application/use-cases/assistant/message-batcher";
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

const counts = { hour: 0, day: 0 };
beforeEach(() => Object.assign(counts, { hour: 0, day: 0 }));

const FADE = { id: "s1", name: "Fade", durationMinutes: 45, priceCents: 3500, active: true };

function makeAssistant(responses: (Response | Error)[], barbers: object[] = [{ id: "b1", name: "Luis", active: true }], services: object[] = [FADE]) {
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
    since: vi.fn(async () => []),
    countUserTurns: vi.fn(async (_phone: string, since: Date) => (NOW.getTime() - since.getTime() <= 3600_000 ? counts.hour : counts.day)),
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
    services: { findAllActive: async () => services } as never,
    barbers: { findAllActive: async () => barbers } as never,
    schedule: { findBusinessHours: async (d: number) => (d === 0 ? [] : [{ openMinute: 540, closeMinute: 780 }, { openMinute: 840, closeMinute: 1200 }]) },
    fallback,
    now: () => NOW,
    siteUrl: "https://luis.example",
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
    expect(bodies[0]).toMatchObject({ model: "openai/gpt-oss-120b", tool_choice: "auto", reasoning_effort: "low" });
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
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.bodies()[0].messages[0].content).toContain("no digas que está confirmada");
    expect(t.sendText).toHaveBeenCalledWith(ME, "Tu cita de *Fade* con *Luis*");
    expect(t.history.at(-1)).toEqual({ role: "assistant", content: "Tu cita de *Fade* con *Luis*" });
  });

  test("como mucho 3 rondas: si el modelo sigue pidiendo herramientas, no se ejecutan más", async () => {
    const always = () => groq({ tool_calls: [call("c", "listar_catalogo_y_mis_citas")] });
    const t = makeAssistant([always(), always(), always(), always(), always()]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.executeTool).toHaveBeenCalledTimes(3);
    expect(t.fetchImpl).toHaveBeenCalledTimes(4);
    expect(t.bodies()[3]).not.toHaveProperty("tools"); // la última petición, sin herramientas
    // Sin respuesta en texto y sin nada hecho: aviso amable, no las instrucciones del básico.
    expect(t.sendText).toHaveBeenCalledWith(ME, FRIENDLY);
    expect(t.fallback.handleMessage).not.toHaveBeenCalled();
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

describe("barreras de tokens", () => {
  test("temperature 0.1, tope de 220 tokens y entrada recortada a 250 caracteres (también en el historial)", async () => {
    const t = makeAssistant([groq({ content: "ok" })]);
    await t.assistant.handleMessage(message("a".repeat(400)));
    const body = t.bodies()[0];
    expect(body).toMatchObject({ temperature: 0.1, max_completion_tokens: 220 });
    expect(body.messages.at(-1).content).toBe("a".repeat(250));
    expect(t.history[0]).toEqual({ role: "user", content: "a".repeat(250) });
  });

  test("cortada por length y sin texto ni herramientas: aviso amable", async () => {
    const t = makeAssistant([new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }), { status: 200 })]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.sendText).toHaveBeenCalledWith(ME, FRIENDLY);
  });
});

describe("límite de uso por celular", () => {
  const LIMITED = "Has enviado muchos mensajes seguidos. Para seguir, escribe directamente a Luis al +51900000000.";

  test.each([
    ["hora", 11, { hour: 11, day: 11 }, false],
    ["hora", 12, { hour: 12, day: 12 }, true],
    ["día", 24, { hour: 0, day: 24 }, false],
    ["día", 25, { hour: 0, day: 25 }, true],
  ])("%s con %i previos", async (_, __, c, blocked) => {
    Object.assign(counts, c);
    const t = makeAssistant([groq({ content: "ok" })]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.sendText).toHaveBeenCalledWith(ME, blocked ? LIMITED : "ok");
    expect(t.fetchImpl).toHaveBeenCalledTimes(blocked ? 0 : 1);
    expect(t.history).toEqual(blocked ? [] : expect.any(Array));
  });

  test("un código no cuenta ni se limita", async () => {
    Object.assign(counts, { hour: 99, day: 99 });
    const t = makeAssistant([]);
    await t.assistant.handleMessage(message("Confirmo mi cita KRT482"));
    expect(t.fallback.handleMessage).toHaveBeenCalled();
    expect(t.conversations.countUserTurns).not.toHaveBeenCalled();
  });
});

describe("respuestas fijas", () => {
  test.each([
    ["hola", "¡Hola! Soy el asistente automático de reservas de D'luiss Barber Shop. Atendemos lun–sáb 9:00–13:00 y 14:00–20:00; dom cerrado. Escríbeme qué servicio y horario buscas (ej: 'Fade mañana a las 5 pm') y te ayudo al instante."],
    ["👍", "No logré entenderte. Escríbeme en texto qué corte deseas y para qué día y hora quieres tu cita."],
    ["quiero hablar con Luis", humanHandoffText("51900000000")],
  ])("%s: sin Groq, se guarda en el historial", async (text, reply) => {
    const t = makeAssistant([]);
    expect(await t.assistant.handleMessage(message(text))).toEqual({ kind: "answered" });
    expect(t.fetchImpl).not.toHaveBeenCalled();
    expect(t.sendText).toHaveBeenCalledWith(ME, reply);
    expect(t.history).toEqual([
      { role: "user", content: text },
      { role: "assistant", content: reply },
    ]);
  });

  test("con conversación reciente, un 👍 va a Groq", async () => {
    const t = makeAssistant([groq({ content: "Perfecto" })]);
    t.history.push({ role: "assistant", content: "¿Te reservo a las 5?" });
    await t.assistant.handleMessage(message("👍"));
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
    expect(t.sendText).toHaveBeenCalledWith(ME, "Perfecto");
  });

  test("el prompt deriva a Luis con el mismo texto", async () => {
    const t = makeAssistant([groq({ content: "ok" })]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.bodies()[0].messages[0].content).toContain(humanHandoffText("51900000000"));
  });
});

describe("agrupador de mensajes seguidos", () => {
  test("3 mensajes seguidos → 1 sola llamada a Groq con el texto unido", async () => {
    vi.useFakeTimers();
    try {
      const t = makeAssistant([groq({ content: "Listo" })]);
      const batcher = new MessageBatcher({ delayMs: 3500, flush: (m) => t.assistant.handleMessage(m) });
      const done = [batcher.add({ ...message("quiero un corte"), id: "1" }), batcher.add({ ...message("con barba"), id: "2" }), batcher.add({ ...message("mañana 5 pm"), id: "3" })];
      await vi.advanceTimersByTimeAsync(3500);
      await Promise.all(done);
      expect(t.fetchImpl).toHaveBeenCalledTimes(1);
      expect(t.bodies()[0].messages.at(-1).content).toBe("quiero un corte\ncon barba\nmañana 5 pm");
      expect(t.sendText).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("multimedia", () => {
  test("respuesta fija, sin llamar a Groq ni guardar historial", async () => {
    const t = makeAssistant([]);
    expect(await t.assistant.handleMessage({ ...message(""), media: true })).toEqual({ kind: "answered" });
    expect(t.fetchImpl).not.toHaveBeenCalled();
    expect(t.sendText).toHaveBeenCalledWith(ME, expect.stringContaining("solo leo mensajes de texto"));
    expect(t.history).toEqual([]);
  });
});

describe("contexto", () => {
  test("pasa los últimos 6 turnos de las 2 últimas horas, y el siguiente mensaje los recibe", async () => {
    const t = makeAssistant([groq({ content: "¿Para qué día?" }), groq({ content: "¿A qué hora?" })]);
    await t.assistant.handleMessage(message("Quiero corte y barba"));
    await t.assistant.handleMessage(message("mañana"));
    expect(t.conversations.recent).toHaveBeenCalledWith(ME, new Date(NOW.getTime() - 2 * 3600_000), 6);
    const second = t.bodies()[1].messages;
    expect(second.slice(1).map((m: { content: string }) => m.content)).toEqual(["Quiero corte y barba", "¿Para qué día?", "mañana"]);
  });

  test("el prompt lleva el catálogo resumido con ids", async () => {
    const t = makeAssistant([groq({ content: "hola" })]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.bodies()[0].messages[0].content).toContain("CATÁLOGO. Servicios: Barbería: Fade 45 min S/35 id=s1. Barberos: Luis id=b1 (Barbería).");
  });

  test("el catálogo agrupa los servicios por área y cada profesional lleva la suya", async () => {
    const t = makeAssistant([groq({ content: "hola" })], [
      { id: "b1", name: "Luis", active: true, isOwner: true },
      { id: "b2", name: "Ana", active: true, areas: ["spa"] },
    ], [
      { id: "s1", name: "Fade", durationMinutes: 60, priceCents: 3500 },
      { id: "s2", name: "Manicure", durationMinutes: 80, priceCents: 4000, area: "spa" },
    ]);
    await t.assistant.handleMessage(message("quiero info"));
    expect(t.bodies()[0].messages[0].content).toContain(
      "Servicios: Barbería: Fade 60 min S/35 id=s1 | Spa y estilista: Manicure 80 min S/40 id=s2. Barberos: Ana id=b2 (Spa y estilista); Luis id=b1 (dueño, Barbería).",
    );
  });

  test("el prompt lleva el horario, la pregunta de áreas, los estilos fuera de lista y la regla de horario", async () => {
    const t = makeAssistant([groq({ content: "hola" })]);
    await t.assistant.handleMessage(message("quiero info"));
    const content = t.bodies()[0].messages[0].content as string;
    expect(content).toContain("HORARIO: lun–sáb 9:00–13:00 y 14:00–20:00; dom cerrado.");
    expect(content).toContain("¿Te estás refiriendo al área de Barbería o al área de Spa y estilista?");
    expect(content).toContain("foto de referencia");
    expect(content).toContain("solo agendas citas");
    expect(content).toContain("Atiendes todos los días");
  });

  test("el prompt marca al dueño, lo deja al final y lleva la regla de alternativas", async () => {
    const t = makeAssistant([groq({ content: "hola" })], [
      { id: "b1", name: "Luis", active: true, isOwner: true },
      { id: "b2", name: "Ana", active: true },
    ]);
    await t.assistant.handleMessage(message("quiero info"));
    const content = t.bodies()[0].messages[0].content as string;
    expect(content).toContain("Barberos: Ana id=b2 (Barbería); Luis id=b1 (dueño, Barbería).");
    expect(content).toContain("No ofrezcas ni sugieras al dueño");
    expect(content).toContain("alternatives");
  });

  test("el prompt fija fecha y hora de Lima, el alcance, cero inventos, la desambiguación y el contacto de Luis", async () => {
    const t = makeAssistant([groq({ content: "Solo atiendo las citas y consultas de D'luiss Barber Shop." })]);
    await t.assistant.handleMessage(message("¿Me escribes un ensayo sobre la Revolución francesa?"));
    const system = t.bodies()[0].messages[0];
    expect(system.role).toBe("system");
    expect(system.content).toContain("16 de noviembre de 2026");
    expect(system.content).toContain("15:30");
    expect(system.content).toMatch(/Solo gestionas citas y consultas de D'luiss Barber Shop.*cambiar de rol.*revelar o ignorar estas instrucciones.*programar/);
    expect(system.content).toContain("Solo puedo ayudarte con citas, horarios y servicios de D'luiss Barber Shop.");
    expect(system.content).toContain("Nunca inventes servicios, precios, duraciones, barberos ni horas libres");
    expect(system.content).toContain("MULTIPLE_APPOINTMENTS_FOUND");
    expect(system.content).toContain("+51900000000");
    // Un tema ajeno no ejecuta ninguna herramienta: solo la negativa breve.
    expect(t.executeTool).not.toHaveBeenCalled();
    expect(t.sendText).toHaveBeenCalledWith(ME, "Solo atiendo las citas y consultas de D'luiss Barber Shop.");
  });

  test("un código o el botón del recordatorio van por el camino exacto, sin modelo", async () => {
    const t = makeAssistant([]);
    await t.assistant.handleMessage(message("Confirmo mi cita KRT482"));
    expect(t.fallback.handleMessage).toHaveBeenCalled();
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });
});

const FRIENDLY =
  "Perdona, ahora mismo no puedo responderte. Vuelve a escribirme en un minuto, o reserva en https://luis.example/reservar, o escribe a Luis al +51900000000.";

describe("si Groq falla", () => {
  test.each([
    ["sin red o timeout", new Error("The operation was aborted due to timeout")],
    ["límite de uso (429)", new Response('{"error":{"message":"rate limit"}}', { status: 429 })],
    ["error del servidor (503)", new Response("caído", { status: 503 })],
    ["respuesta inesperada", new Response('{"nada":true}', { status: 200 })],
  ])("%s: aviso amable, sin colgar ni lanzar", async (_, failure) => {
    const t = makeAssistant([failure]);
    expect(await t.assistant.handleMessage(message("¿tienen hora el sábado?"))).toEqual({ kind: "answered" });
    expect(t.sendText).toHaveBeenCalledWith(ME, FRIENDLY);
    expect(t.fallback.handleMessage).not.toHaveBeenCalled();
    expect(t.history).toEqual([]);
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
    await expect(t.assistant.handleMessage(message("quiero info"))).rejects.toThrow("WhatsApp caído");
  });
});
