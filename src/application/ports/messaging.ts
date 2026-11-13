/** Mensajes al cliente por WhatsApp. Los teléfonos, como los guarda la app: "51987654321". */
export interface IMessagingService {
  /** Texto libre: WhatsApp solo lo entrega dentro de las 24 h desde el último mensaje del cliente. */
  sendText(toPhone: string, text: string): Promise<void>;
  /** Plantilla aprobada por Meta, para escribir primero (se cobra). Los parámetros llenan {{1}}, {{2}}… */
  sendTemplate(toPhone: string, template: string, parameters: readonly string[]): Promise<void>;
}
