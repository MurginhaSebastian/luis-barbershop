import { z } from "zod";

// Herramientas que podrá usar el asistente de IA. Sus parámetros los llena el modelo, así que nunca incluyen el
// celular del cliente: ese lo pone el servidor (ToolContext.verifiedPhone), tomado del remitente firmado por Meta.
// Sin .transform(): el mismo esquema se exporta a JSON Schema para declarar la herramienta al LLM.

const serviceIds = z.array(z.uuid()).min(1).max(5).describe("Ids de los servicios elegidos (de listar_catalogo_y_mis_citas).");
const barberId = z.uuid().nullable().optional().describe("Id del barbero; vacío o null = sin preferencia.");
const appointmentId = z
  .uuid()
  .optional()
  .describe("Id de la cita (de listar_catalogo_y_mis_citas). Vacío: la única cita activa del cliente.");

export const BOT_TOOLS = {
  listar_catalogo_y_mis_citas: {
    description:
      "Servicios y barberos activos con sus ids, y las citas activas de este cliente. Úsala antes que las demás.",
    schema: z.object({}),
  },
  consultar_huecos_dinamicos: {
    description:
      "Horas libres de un día para esos servicios (la cita dura la suma de sus duraciones), en hora de Lima.",
    schema: z.object({
      serviceIds,
      date: z.iso.date().describe("Día en formato YYYY-MM-DD, en el calendario de Lima."),
      barberId,
    }),
  },
  reservar_cita: {
    description:
      "Reserva para quien escribe en este chat. Con menos de 2 h de antelación nace confirmada; si no, queda pendiente y se le pedirá confirmar 35 min antes.",
    schema: z.object({
      customerName: z.string().trim().min(2).max(60).describe("Nombre de quien viene a la cita."),
      serviceIds,
      barberId,
      startTime: z.iso
        .datetime({ offset: true })
        .describe("Una hora de inicio tal como la devolvió consultar_huecos_dinamicos (con -05:00)."),
    }),
  },
  confirmar_asistencia: {
    description: "Confirma que el cliente vendrá. Sirve también si su cita está en riesgo, mientras nadie haya tomado la hora.",
    schema: z.object({ appointmentId }),
  },
  cancelar_cita: {
    description:
      "Cancela una cita del cliente: con 35 min o más de antelación, o con menos si aún no la había confirmado.",
    schema: z.object({ appointmentId }),
  },
} as const;

export type BotToolName = keyof typeof BOT_TOOLS;

export const isBotTool = (name: string): name is BotToolName => Object.hasOwn(BOT_TOOLS, name);

/** Lo que el adaptador del LLM declara: nombre, descripción y parámetros en JSON Schema. */
export function botToolDefinitions() {
  return Object.entries(BOT_TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    // Los patrones de uuid y fecha cuestan cientos de tokens por petición y Zod los valida igual en el servidor.
    parameters: z.toJSONSchema(tool.schema, {
      override: ({ jsonSchema }) => {
        delete jsonSchema.pattern;
      },
    }),
  }));
}
