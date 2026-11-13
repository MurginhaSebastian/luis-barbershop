import type { IMessagingService } from "@/application/ports/messaging";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { Appointment } from "@/core/entities/appointment";
import {
  type BookingConfirmation,
  CONFIRMATION_CODE_BYTES,
  confirmationCode,
  confirmationDeadline,
} from "@/core/entities/confirmation";

export interface BookingConfirmationDeps {
  confirmations: IConfirmationRepository;
  /** null: WhatsApp sin configurar. Las citas se confirman a mano desde el panel y no vencen. */
  messaging: IMessagingService | null;
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
}

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
}
