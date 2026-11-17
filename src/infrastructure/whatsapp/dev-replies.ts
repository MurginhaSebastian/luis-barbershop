import type { IMessagingService } from "@/application/ports/messaging";

/**
 * Solo fuera de producción: si WhatsApp rechaza el envío (p. ej. con un token de prueba en .env), la respuesta
 * se imprime en la consola en vez de perderse, y el webhook sigue como si hubiera salido.
 */
export function withDevReplies(messaging: IMessagingService): IMessagingService {
  return {
    sendText: (to, text) =>
      messaging.sendText(to, text).catch((error: unknown) => {
        console.log(`[WhatsApp Dev Reply]: ${text}`);
        console.warn(`(no se envió a WhatsApp: ${error instanceof Error ? error.message : String(error)})`);
      }),
    sendTemplate: (to, template, parameters, replies) => messaging.sendTemplate(to, template, parameters, replies),
  };
}
