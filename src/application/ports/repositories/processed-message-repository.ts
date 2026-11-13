/** Mensajes de WhatsApp ya atendidos: Meta reintenta durante días y puede repetir el mismo aviso. */
export interface IProcessedMessageRepository {
  wasProcessed(messageId: string): Promise<boolean>;
  markProcessed(messageId: string): Promise<void>;
}
