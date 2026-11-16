/** Mensajes de WhatsApp ya atendidos: Meta reintenta durante días y puede repetir el mismo aviso. */
export interface IProcessedMessageRepository {
  /** Lo reclama de forma atómica: true solo para la primera petición que lo pide, aunque lleguen a la vez. */
  claim(messageId: string): Promise<boolean>;
  /** Lo suelta (falló al atenderlo), para que el reintento de Meta pueda reclamarlo. */
  release(messageId: string): Promise<void>;
}
