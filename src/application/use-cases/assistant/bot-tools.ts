import { z } from "zod";

// Herramientas que podrá usar el asistente de IA. Sus parámetros los llena el modelo, así que nunca incluyen el
// celular del cliente: ese lo pone el servidor (ToolContext.verifiedPhone), tomado del remitente firmado por Meta.
// Sin .transform(): el mismo esquema se exporta a JSON Schema para declarar la herramienta al LLM.
// Descripciones cortas a propósito: viajan en cada petición y el límite gratis es por tokens/minuto.

const serviceIds = z.array(z.uuid()).min(1).max(5);
const barberId = z.uuid().nullable().optional().describe("Sin él, sin preferencia.");
const appointmentId = z.uuid().optional().describe("Sin él, la única cita.");

export const BOT_TOOLS = {
  listar_catalogo_y_mis_citas: {
    description: "Citas activas del cliente, con sus ids.",
    schema: z.object({}),
  },
  consultar_huecos_dinamicos: {
    description: "Horas libres de un día (hora de Lima).",
    schema: z.object({
      serviceIds,
      date: z.iso.date(),
      barberId,
      franja: z.enum(["manana", "tarde"]).optional().describe("Solo si pidió horas de la mañana o de la tarde."),
    }),
  },
  reservar_cita: {
    description: "Reserva para quien escribe.",
    schema: z.object({
      customerName: z.string().trim().min(2).max(60),
      serviceIds,
      barberId,
      startTime: z.iso.datetime({ offset: true }).describe("Tal como lo devolvió consultar_huecos_dinamicos."),
    }),
  },
  confirmar_asistencia: {
    description: "Confirma que el cliente vendrá.",
    schema: z.object({ appointmentId }),
  },
  cancelar_cita: {
    description: "Cancela una cita del cliente.",
    schema: z.object({ appointmentId }),
  },
} as const;

export type BotToolName = keyof typeof BOT_TOOLS;

export const isBotTool = (name: string): name is BotToolName => Object.hasOwn(BOT_TOOLS, name);

/** Lo que el adaptador del LLM declara: nombre, descripción y parámetros en JSON Schema. */
export function botToolDefinitions() {
  return Object.entries(BOT_TOOLS).map(([name, tool]) => {
    const parameters = z.toJSONSchema(tool.schema, {
      override: ({ jsonSchema }) => {
        // Los patrones de uuid y fecha cuestan cientos de tokens por petición y Zod los valida igual en el servidor.
        delete jsonSchema.pattern;
        // Los límites y additionalProperties tampoco hacen falta: el ejecutor valida con Zod (los descarta o los rechaza).
        for (const key of ["minItems", "maxItems", "minLength", "maxLength"]) delete jsonSchema[key];
        if (jsonSchema.additionalProperties === false) delete jsonSchema.additionalProperties;
        // El adaptador de Groq usa alias cortos (s1, b1, a1) en vez de uuid: el formato no se declara.
        if (jsonSchema.format === "uuid") delete jsonSchema.format;
      },
    });
    delete parameters.$schema;
    return { name, description: tool.description, parameters };
  });
}
