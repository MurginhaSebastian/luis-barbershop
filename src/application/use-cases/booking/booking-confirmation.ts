import type { AiAssistantPort, IncomingMessage, MessageOutcome } from "@/application/ports/assistant";
import type { IMessagingService } from "@/application/ports/messaging";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { ISiteSettingsRepository } from "@/application/ports/repositories/site-settings-repository";
import { shopDateTime } from "@/application/shop-time";
import { type Appointment, AppointmentStatus } from "@/core/entities/appointment";
import {
  type BookingConfirmation,
  CONFIRMATION_CODE_BYTES,
  codeInMessage,
  confirmationCode,
  wantsToCancel,
  confirmationDeadline,
} from "@/core/entities/confirmation";
import { normalizePhone } from "@/core/entities/customer";
import { SlotUnavailableError } from "@/core/errors/domain-errors";
import { shopDateOf } from "@/core/scheduling/availability";
import { CUSTOMER_CANCEL_MIN_MINUTES } from "@/core/scheduling/booking-policy";

export interface BookingConfirmationDeps {
  appointments: IAppointmentRepository;
  customers: ICustomerRepository;
  barbers: IBarberRepository;
  confirmations: IConfirmationRepository;
  /** De aquí sale el WhatsApp de Luis, para quien escribe al número automático con una consulta. */
  siteSettings: ISiteSettingsRepository;
  /** null: WhatsApp sin configurar. Las citas se confirman a mano desde el panel y no vencen. */
  messaging: IMessagingService | null;
  /** Número conectado a la API, al que el cliente escribe para confirmar. Aparte del WhatsApp de Luis. */
  confirmationNumber: string | null;
  /** Dirección pública de la web, para enlazar a la reserva en los mensajes. */
  siteUrl?: string;
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
}

/**
 * Plantilla aprobada en Meta: "Hola {{1}}, tu reserva del {{2}} se liberó porque no se confirmó a tiempo…", con un
 * botón de enlace fijo a /reservar. Meta rechaza plantillas que empiezan o terminan en una variable.
 */
export const EXPIRED_TEMPLATE = "cita_vencida";

/** El cliente confirma o cancela su cita por WhatsApp. Los plazos los aplica ConfirmationCycleUseCase. */
export class BookingConfirmationUseCase implements AiAssistantPort {
  constructor(private readonly deps: BookingConfirmationDeps) {}

  get enabled(): boolean {
    return this.deps.messaging !== null && !!this.deps.confirmationNumber;
  }

  /** A qué número escribe el cliente para confirmar (null si no hay confirmación por WhatsApp). */
  get confirmationNumber(): string | null {
    return this.enabled ? this.deps.confirmationNumber : null;
  }

  /**
   * Da código y plazo a una cita recién reservada. Sin WhatsApp o sin un número al que escribir no hay plazo:
   * vencerla sería castigar al cliente por algo que no podía hacer.
   */
  async issue(appointment: Appointment): Promise<BookingConfirmation | null> {
    // Una cita que nace confirmada (reservada con menos de 2 h) no tiene nada que confirmar.
    if (!this.enabled || appointment.status !== AppointmentStatus.PENDING) return null;
    const confirmation: BookingConfirmation = {
      appointmentId: appointment.id,
      code: confirmationCode(this.deps.randomBytes(CONFIRMATION_CODE_BYTES)),
      confirmBy: confirmationDeadline(appointment.slot.start),
    };
    await this.deps.confirmations.save(confirmation);
    return confirmation;
  }

  /**
   * Atiende un mensaje del cliente y le responde. Solo confirma si el código es de una cita de ese mismo número.
   * Que no se atienda dos veces lo garantiza HandleIncomingMessageUseCase, que lo reclama antes.
   */
  async handleMessage(message: IncomingMessage): Promise<MessageOutcome> {
    const messaging = this.deps.messaging;
    if (!messaging) return { kind: "ignored" };
    const phone = normalizePhone(message.from);
    const outcome = await this.confirmFrom(phone, message.text);
    await messaging.sendText(phone, await this.reply(outcome));
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
      return wantsToCancel(text) ? this.cancel(appointment) : this.confirm(appointment);
    }
    return { kind: "not-found" };
  }

  /**
   * El cliente confirma su cita (por WhatsApp hoy; el asistente con IA la llamará igual). Pendiente o en riesgo
   * ("salvado por la campana") pasa a CONFIRMED solo si sigue así al guardar: nunca pisa otro cambio.
   */
  async confirm(appointment: Appointment): Promise<MessageOutcome> {
    const { status } = appointment;
    if (status !== AppointmentStatus.PENDING && status !== AppointmentStatus.AT_RISK) return this.closedOutcome(appointment);
    const confirmed = appointment.changeStatus(AppointmentStatus.CONFIRMED);
    try {
      if (await this.deps.appointments.updateStatus(confirmed, status)) return { kind: "confirmed", appointment: confirmed };
    } catch (error) {
      // En riesgo, otro cliente tomó la hora sin desplazarla (justo cuando pasaba a riesgo): ya no cabe.
      if (error instanceof SlotUnavailableError) return { kind: "slot-taken", appointment };
      throw error;
    }
    // Otro la tomó, venció o la canceló el barbero en ese mismo instante: se responde según cómo quedó.
    const now = await this.deps.appointments.findById(appointment.id);
    return now ? this.closedOutcome(now) : { kind: "not-found" };
  }

  /**
   * El cliente cancela su cita (como confirmar: WhatsApp hoy, el asistente mañana). La regla de los 35 min la
   * decide `customerCanCancel`; si no puede, "too-late". Nunca pisa otro cambio.
   */
  async cancel(appointment: Appointment): Promise<MessageOutcome> {
    const { status } = appointment;
    const active = status === AppointmentStatus.PENDING || status === AppointmentStatus.CONFIRMED || status === AppointmentStatus.AT_RISK;
    if (!active) return this.closedOutcome(appointment);
    if (!appointment.customerCanCancel(this.deps.now())) return { kind: "too-late", appointment };
    const cancelled = appointment.changeStatus(AppointmentStatus.CANCELLED);
    if (await this.deps.appointments.updateStatus(cancelled, status)) return { kind: "cancelled", appointment: cancelled };
    const now = await this.deps.appointments.findById(appointment.id);
    return now ? this.closedOutcome(now) : { kind: "not-found" };
  }

  private closedOutcome(appointment: Appointment): MessageOutcome {
    if (appointment.status === AppointmentStatus.CONFIRMED) return { kind: "already-confirmed" };
    if (appointment.status === AppointmentStatus.EXPIRED) return { kind: "slot-taken", appointment };
    return { kind: "inactive" };
  }

  /** La web en el paso de elegir hora, con sus mismos servicios, barbero y día: ahí ve las horas libres. */
  private rebookLink(appointment: Appointment): string | null {
    if (!this.deps.siteUrl) return null;
    const params = new URLSearchParams({ paso: "3" });
    for (const s of appointment.services) params.append("servicios", s.serviceId);
    params.append("barbero", appointment.barberId);
    params.append("dia", shopDateOf(appointment.slot.start));
    return `${this.deps.siteUrl}/reservar?${params}`;
  }

  /**
   * Avisa a cada cliente de que su hora quedó libre por no confirmar a tiempo (otro la tomó o venció), con la
   * plantilla aprobada: el cliente no ha escrito en 24 h. Un aviso fallido no impide los demás.
   */
  async notifyReleased(appointments: readonly Appointment[]): Promise<{ sent: number; failed: number }> {
    const report = { sent: 0, failed: 0 };
    const messaging = this.deps.messaging;
    if (!messaging || appointments.length === 0) return report;
    const customers = await this.deps.customers.findByIds([...new Set(appointments.map((a) => a.customerId))]);
    for (const appointment of appointments) {
      try {
        const customer = customers.find((c) => c.id === appointment.customerId);
        if (!customer) throw new Error(`Cliente ${appointment.customerId} no encontrado`);
        await messaging.sendTemplate(customer.phone, EXPIRED_TEMPLATE, [appointment.customerName, shopDateTime(appointment.slot.start)]);
        report.sent++;
      } catch {
        report.failed++;
      }
    }
    return report;
  }

  private async reply(outcome: MessageOutcome): Promise<string> {
    const book = this.deps.siteUrl ? `Reserva otra hora aquí: ${this.deps.siteUrl}/reservar` : "Reserva otra hora en nuestra web.";
    switch (outcome.kind) {
      case "confirmed": {
        const { appointment } = outcome;
        const [barber] = await this.deps.barbers.findByIds([appointment.barberId]);
        return `¡Listo, ${appointment.customerName}! Tu cita del ${shopDateTime(appointment.slot.start)} con ${barber?.name ?? "tu barbero"} quedó confirmada. Te esperamos en Luis Barbershop.`;
      }
      case "cancelled":
        return `Listo, cancelamos tu cita del ${shopDateTime(outcome.appointment.slot.start)}. Gracias por avisar: la hora queda libre para otro cliente. ${book}`;
      case "too-late": {
        const { whatsapp } = (await this.deps.siteSettings.get()).contact;
        const call = whatsapp ? `Si no puedes venir, avísanos al +${whatsapp}.` : "Si no puedes venir, avísanos en la barbería.";
        return `Tu cita del ${shopDateTime(outcome.appointment.slot.start)} ya está confirmada y faltan menos de ${CUSTOMER_CANCEL_MIN_MINUTES} minutos: no se puede cancelar por aquí. ${call}`;
      }
      case "already-confirmed":
        return "Tu cita ya estaba confirmada. ¡Te esperamos!";
      case "slot-taken": {
        const link = this.rebookLink(outcome.appointment);
        const next = link ? `Mira las horas libres que quedan aquí: ${link}` : book;
        return `Lo sentimos: como no se confirmó a tiempo, tu hora del ${shopDateTime(outcome.appointment.slot.start)} ya no está disponible. ${next}`;
      }
      case "inactive":
        return `Esa cita ya no está activa. ${book}`;
      case "not-found":
        return "No encontramos una reserva con ese código para este número. Escríbenos desde el celular con el que reservaste y revisa el código.";
      case "no-code":
      case "ignored": {
        // Este número solo confirma: las consultas van al WhatsApp de Luis, que las lee él.
        const { whatsapp } = (await this.deps.siteSettings.get()).contact;
        const ask = whatsapp ? `Para consultas escríbenos a +${whatsapp}.` : book;
        return `Este número solo confirma o cancela citas: envía tu código, por ejemplo "Confirmo mi cita KRT482" o "Cancelar KRT482". ${ask}`;
      }
    }
  }
}
