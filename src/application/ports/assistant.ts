import type { Appointment } from "@/core/entities/appointment";

/** Un mensaje que llegó por WhatsApp, ya firmado por Meta. `from`: el número del cliente, solo cifras ("51987654321"). */
export interface IncomingMessage {
  id: string;
  from: string;
  /** El texto escrito, o el que devuelve el botón o la opción de lista que tocó. */
  text: string;
}

export type MessageOutcome =
  | { kind: "confirmed" | "cancelled"; appointment: Appointment }
  /** Confirmada y faltan menos de 35 min: no se cancela sola, hay que avisar a la barbería. */
  | { kind: "too-late"; appointment: Appointment }
  /** SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER: no confirmó a tiempo y su hora ya es de otro (o venció). */
  | { kind: "slot-taken"; appointment: Appointment }
  | { kind: "ignored" | "no-code" | "not-found" | "already-confirmed" | "inactive" }
  /** Respondió el asistente de IA; sus herramientas ya avisaron al barbero de lo que cambió. */
  | { kind: "answered" };

/**
 * Quien atiende los mensajes del número automático y le responde al cliente. Hoy lo hace
 * BookingConfirmationUseCase (código + palabras clave); el asistente de IA será otro adaptador de este puerto,
 * que use BotToolExecutor con `verifiedPhone = message.from`. Un mensaje repetido por Meta se ignora.
 */
export interface AiAssistantPort {
  handleMessage(message: IncomingMessage): Promise<MessageOutcome>;
}
