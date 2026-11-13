import type { IMessagingService } from "@/application/ports/messaging";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IProcessedMessageRepository } from "@/application/ports/repositories/processed-message-repository";
import { shopDateTime } from "@/application/shop-time";
import { type Appointment, AppointmentStatus } from "@/core/entities/appointment";
import {
  type BookingConfirmation,
  CONFIRMATION_CODE_BYTES,
  codeInMessage,
  confirmationCode,
  confirmationDeadline,
} from "@/core/entities/confirmation";
import { normalizePhone } from "@/core/entities/customer";

export interface BookingConfirmationDeps {
  appointments: IAppointmentRepository;
  customers: ICustomerRepository;
  barbers: IBarberRepository;
  confirmations: IConfirmationRepository;
  processedMessages: IProcessedMessageRepository;
  /** null: WhatsApp sin configurar. Las citas se confirman a mano desde el panel y no vencen. */
  messaging: IMessagingService | null;
  /** Dirección pública de la web, para enlazar a la reserva en los mensajes. */
  siteUrl?: string;
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
}

/** Un mensaje de texto que llegó por WhatsApp. `from`: el número del cliente, solo cifras ("51987654321"). */
export interface IncomingMessage {
  id: string;
  from: string;
  text: string;
}

export type MessageOutcome =
  | { kind: "confirmed"; appointment: Appointment }
  | { kind: "ignored" | "no-code" | "not-found" | "already-confirmed" | "expired" | "inactive" };

/** El cliente confirma su cita por WhatsApp; si no lo hace a tiempo, el hueco se libera. */
export class BookingConfirmationUseCase {
  constructor(private readonly deps: BookingConfirmationDeps) {}

  get enabled(): boolean {
    return this.deps.messaging !== null;
  }

  /**
   * Da código y plazo a una cita recién reservada. Sin WhatsApp o sin un número al que escribir no hay plazo:
   * vencerla sería castigar al cliente por algo que no podía hacer.
   */
  async issue(appointment: Appointment, shopWhatsapp: string | undefined): Promise<BookingConfirmation | null> {
    if (!this.enabled || !shopWhatsapp) return null;
    const confirmation: BookingConfirmation = {
      appointmentId: appointment.id,
      code: confirmationCode(this.deps.randomBytes(CONFIRMATION_CODE_BYTES)),
      confirmBy: confirmationDeadline(this.deps.now(), appointment.slot.start),
    };
    await this.deps.confirmations.save(confirmation);
    return confirmation;
  }

  /**
   * Atiende un mensaje del cliente y le responde. Solo confirma si el código es de una cita de ese mismo número.
   * Se marca como atendido al final: si algo falla a medias, Meta reintenta y el resultado es el mismo.
   */
  async handleMessage(message: IncomingMessage): Promise<MessageOutcome> {
    const messaging = this.deps.messaging;
    if (!messaging || (await this.deps.processedMessages.wasProcessed(message.id))) return { kind: "ignored" };
    const phone = normalizePhone(message.from);
    const outcome = await this.confirmFrom(phone, message.text);
    await messaging.sendText(phone, await this.reply(outcome));
    await this.deps.processedMessages.markProcessed(message.id);
    return outcome;
  }

  private async confirmFrom(phone: string, text: string): Promise<MessageOutcome> {
    const code = codeInMessage(text);
    if (!code) return { kind: "no-code" };
    const customer = await this.deps.customers.findByPhone(phone);
    if (!customer) return { kind: "not-found" };

    for (const candidate of await this.deps.confirmations.findByCode(code)) {
      const appointment = await this.deps.appointments.findById(candidate.appointmentId);
      if (appointment?.customerId !== customer.id) continue;
      // Pasado el plazo pero aún pendiente (la tarea de vencer no ha pasado): el hueco sigue siendo suyo.
      if (appointment.status === AppointmentStatus.PENDING) {
        const confirmed = appointment.changeStatus(AppointmentStatus.CONFIRMED);
        await this.deps.appointments.save(confirmed);
        return { kind: "confirmed", appointment: confirmed };
      }
      if (appointment.status === AppointmentStatus.CONFIRMED) return { kind: "already-confirmed" };
      if (appointment.status === AppointmentStatus.EXPIRED) return { kind: "expired" };
      return { kind: "inactive" };
    }
    return { kind: "not-found" };
  }

  private async reply(outcome: MessageOutcome): Promise<string> {
    const book = this.deps.siteUrl ? `Reserva otra hora aquí: ${this.deps.siteUrl}/reservar` : "Reserva otra hora en nuestra web.";
    switch (outcome.kind) {
      case "confirmed": {
        const { appointment } = outcome;
        const [barber] = await this.deps.barbers.findByIds([appointment.barberId]);
        return `¡Listo, ${appointment.customerName}! Tu cita del ${shopDateTime(appointment.slot.start)} con ${barber?.name ?? "tu barbero"} quedó confirmada. Te esperamos en Luis Barbershop.`;
      }
      case "already-confirmed":
        return "Tu cita ya estaba confirmada. ¡Te esperamos!";
      case "expired":
        return `Esa reserva venció porque no se confirmó a tiempo y la hora quedó libre. ${book}`;
      case "inactive":
        return `Esa cita ya no está activa. ${book}`;
      case "not-found":
        return "No encontramos una reserva con ese código para este número. Escríbenos desde el celular con el que reservaste y revisa el código.";
      case "no-code":
      case "ignored":
        return `Por aquí confirmamos las citas: envía el mensaje con tu código, por ejemplo "Confirmo mi cita KRT482". ${book}`;
    }
  }
}
