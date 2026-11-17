import type { AiAssistantPort, IncomingMessage, MessageOutcome } from "@/application/ports/assistant";
import type { IProcessedMessageRepository } from "@/application/ports/repositories/processed-message-repository";

/**
 * Cada mensaje de WhatsApp se atiende una sola vez. Se reclama ANTES de llamar al asistente: con la IA tarda
 * segundos y Meta puede repetir el aviso mientras tanto; el repetido encuentra el mensaje reclamado y no hace nada.
 */
export class HandleIncomingMessageUseCase {
  constructor(private readonly deps: { processedMessages: IProcessedMessageRepository; assistant: AiAssistantPort }) {}

  async execute(message: IncomingMessage): Promise<MessageOutcome> {
    if (!(await this.deps.processedMessages.claim(message.id))) return { kind: "ignored" };
    try {
      return await this.deps.assistant.handleMessage(message);
    } catch (error) {
      // Falló antes de terminar (base caída, WhatsApp sin responder): se libera para que el reintento de Meta lo
      // atienda. Confirmar y cancelar no cambian dos veces; una reserva repetida solo choca si es la misma hora,
      // por eso el asistente de IA, una vez que cambió una cita, ya no lanza errores hasta aquí.
      await this.deps.processedMessages.release(message.id);
      throw error;
    }
  }
}
