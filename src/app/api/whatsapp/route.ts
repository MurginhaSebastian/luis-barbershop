import { after } from "next/server";
import { z } from "zod";
import { codeInMessage } from "@/core/entities/confirmation";
import { getMessageBatcher, getUseCases, getWhatsAppConfig } from "@/infrastructure/container";
import { isSignedByMeta } from "@/infrastructure/whatsapp/whatsapp-cloud";

// Webhook de WhatsApp: Meta lo llama una vez al configurarlo (GET) y luego con cada mensaje o estado (POST).

const notification = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            messages: z
              .array(
                z.object({
                  id: z.string().min(1).max(200),
                  // Solo cifras con código de país; si el cliente usa nombre de usuario, Meta puede no enviarlo.
                  from: z.string().regex(/^\d{8,15}$/).optional(),
                  type: z.string(),
                  text: z.object({ body: z.string().max(4096) }).optional(),
                  // Botón de respuesta rápida de una plantilla: trae el texto que se le puso al enviarla.
                  button: z.object({ payload: z.string().max(1000) }).optional(),
                  // Botón o lista de un mensaje interactivo (los que envíe el asistente dentro de las 24 h): su id.
                  interactive: z
                    .object({
                      button_reply: z.object({ id: z.string().max(256) }).optional(),
                      list_reply: z.object({ id: z.string().max(200) }).optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

type Message = NonNullable<z.infer<typeof notification>["entry"][number]["changes"][number]["value"]["messages"]>[number];

const MEDIA_TYPES = new Set(["audio", "image", "sticker", "video", "document"]);

/** Lo que dijo el cliente: el texto, el de la respuesta rápida o el id del botón o la opción que tocó. */
function messageText(m: Message): string | undefined {
  if (m.type === "text") return m.text?.body;
  if (m.type === "button") return m.button?.payload;
  if (m.type === "interactive") return (m.interactive?.button_reply ?? m.interactive?.list_reply)?.id;
  return undefined;
}

export function GET(request: Request) {
  const config = getWhatsAppConfig();
  const params = new URL(request.url).searchParams;
  if (config && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === config.verifyToken) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const config = getWhatsAppConfig();
  if (!config) return new Response("Not found", { status: 404 });

  // La firma se calcula sobre el cuerpo tal cual llegó: antes de interpretar nada.
  const raw = await request.text();
  if (!isSignedByMeta(raw, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  // Firmado por Meta pero de otro tipo (estados de entrega, otros campos): se acepta para que no reintente.
  const parsed = notification.safeParse(json);
  if (!parsed.success) return new Response("OK", { status: 200 });

  const messages = parsed.data.entry
    .flatMap((entry) => entry.changes)
    .filter((change) => change.field === "messages" && change.value.metadata?.phone_number_id === config.phoneNumberId)
    .flatMap((change) => change.value.messages ?? [])
    .flatMap((m) => {
      if (!m.from) return [];
      // Fotos, audios… llegan como tal: el asistente responde que solo lee texto. Reacciones y demás, en silencio.
      if (MEDIA_TYPES.has(m.type)) return [{ batchable: false, message: { id: m.id, from: m.from, text: "", media: true as const } }];
      const text = messageText(m);
      // Solo el texto escrito se agrupa: los botones y los códigos se atienden al momento.
      return text ? [{ batchable: m.type === "text" && !codeInMessage(text), message: { id: m.id, from: m.from, text } }] : [];
    });

  const { incomingMessages, managePush } = getUseCases();
  const batcher = getMessageBatcher();
  try {
    for (const { message, batchable } of messages) {
      if (batcher && batchable) {
        // Se reclama antes del 200 (un repetido de Meta no entra) y se atiende después, junto a los que lleguen
        // seguidos. Si el lote falla Meta ya no reintenta: se registra.
        if (await incomingMessages.claim(message.id)) {
          after(() => batcher.add(message).catch((error) => console.error(`lote de mensajes (…${message.from.slice(-3)})`, error)));
        }
        continue;
      }
      // Reclamado al empezar: un aviso repetido por Meta mientras este sigue en curso no se atiende dos veces.
      const outcome = await incomingMessages.execute(message);
      if (outcome.kind === "confirmed" || outcome.kind === "cancelled") {
        const { kind, appointment } = outcome;
        after(() =>
          (kind === "confirmed" ? managePush.notifyConfirmed(appointment) : managePush.notifyCancelled(appointment)).catch(
            (error) => console.error(`aviso al barbero (${kind})`, error),
          ),
        );
      }
    }
  } catch (error) {
    // Con un error, Meta reintenta: lo ya atendido no se repite (processed_messages).
    console.error("webhook de WhatsApp", error);
    return new Response("Error", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}
