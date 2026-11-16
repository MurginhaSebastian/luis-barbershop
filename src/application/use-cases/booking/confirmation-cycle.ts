import type { IMessagingService } from "@/application/ports/messaging";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import { shopTime } from "@/application/shop-time";
import { type Appointment, AppointmentStatus } from "@/core/entities/appointment";
import { MINUTE_MS } from "@/core/entities/time-slot";
import { AT_RISK_MINUTES_BEFORE, REMINDER_MINUTES_BEFORE } from "@/core/scheduling/booking-policy";

/**
 * Plantilla aprobada en Meta (utilidad): "Hola {{1}}, tu cita de hoy a las {{2}} en Luis Barbershop está por
 * empezar. Si no la confirmas antes de las {{3}}, la hora quedará libre para otro cliente. ¿Vienes?", con dos
 * botones de respuesta rápida: "Sí, voy" y "No podré ir". Cada botón devuelve el texto que se le pone al enviar.
 */
export const REMINDER_TEMPLATE = "recordatorio_cita";

export interface ConfirmationCycleDeps {
  appointments: IAppointmentRepository;
  customers: ICustomerRepository;
  confirmations: IConfirmationRepository;
  /** null: WhatsApp sin configurar. Nadie pudo confirmar, así que nada se pone en riesgo. */
  messaging: IMessagingService | null;
  /** Aviso al barbero de que una hora quedó libre (lo cumple ManagePushUseCase). */
  alerts: { notifyAtRisk(appointment: Appointment): Promise<unknown> };
  now: () => Date;
}

export interface CycleReport {
  /** Recibieron el aviso de -35 min. */
  reminded: number;
  /** Pasaron a en riesgo: faltan 15 min o menos y no confirmaron. */
  atRisk: number;
  /** Seguían en riesgo a su hora: vencidas. */
  expired: number;
  /** Avisos que no salieron (la cita cambia de estado igual). */
  failed: number;
}

/**
 * Lo llama el cron cada 5 minutos. A) a los -35 min pide confirmación por WhatsApp; B) a los -15 min, si sigue
 * pendiente, la pone en riesgo (otro cliente puede tomar la hora) y avisa al barbero; C) a su hora, si sigue en
 * riesgo, vence. Todo cambio de estado es condicional: si el cliente confirma a la vez, gana su confirmación.
 */
export class ConfirmationCycleUseCase {
  constructor(private readonly deps: ConfirmationCycleDeps) {}

  async run(): Promise<CycleReport> {
    const report: CycleReport = { reminded: 0, atRisk: 0, expired: 0, failed: 0 };
    const now = this.deps.now();
    if (this.deps.messaging) {
      // Solo las que recibieron código al reservar: las demás no tenían cómo confirmar y las decide el barbero.
      const pending = await this.deps.appointments.findByStatusFrom(AppointmentStatus.PENDING, now);
      const codes = await this.deps.confirmations.findByAppointments(pending.map((a) => a.id));
      const withCode = pending.flatMap((a) => {
        const code = codes.find((c) => c.appointmentId === a.id)?.code;
        return code ? [{ appointment: a, code }] : [];
      });
      await this.remind(withCode, now, this.deps.messaging, report);
      await this.putAtRisk(withCode.map((p) => p.appointment), now, report);
    }
    await this.expireAtRisk(now, report);
    return report;
  }

  /** A) Entre -35 y -15 min, una sola vez por cita (la marca se toma antes de enviar: dos crons no repiten). */
  private async remind(pending: { appointment: Appointment; code: string }[], now: Date, messaging: IMessagingService, report: CycleReport) {
    const due = pending.filter(({ appointment }) => {
      const left = minutesUntil(appointment, now);
      return left > AT_RISK_MINUTES_BEFORE && left <= REMINDER_MINUTES_BEFORE;
    });
    if (due.length === 0) return;
    const customers = await this.deps.customers.findByIds(due.map((d) => d.appointment.customerId));
    for (const { appointment, code } of due) {
      if (!(await this.deps.appointments.claimReminder(appointment.id, now))) continue;
      try {
        const customer = customers.find((c) => c.id === appointment.customerId);
        if (!customer) throw new Error(`Cliente ${appointment.customerId} no encontrado`);
        const start = appointment.slot.start;
        const deadline = new Date(start.getTime() - AT_RISK_MINUTES_BEFORE * MINUTE_MS);
        await messaging.sendTemplate(
          customer.phone,
          REMINDER_TEMPLATE,
          [appointment.customerName, shopTime(start), shopTime(deadline)],
          [`Confirmo mi cita ${code}`, `Cancelar ${code}`],
        );
        report.reminded++;
      } catch {
        // Sin aviso no hay marca: el próximo ciclo lo intenta de nuevo mientras siga a tiempo.
        await this.deps.appointments.releaseReminder(appointment.id);
        report.failed++;
      }
    }
  }

  /** B) Faltan 15 min o menos (pero aún no empieza): en riesgo. Una pendiente ya empezada la decide el barbero. */
  private async putAtRisk(pending: Appointment[], now: Date, report: CycleReport) {
    for (const appointment of pending) {
      const left = minutesUntil(appointment, now);
      if (left > AT_RISK_MINUTES_BEFORE || left <= 0) continue;
      const atRisk = appointment.changeStatus(AppointmentStatus.AT_RISK);
      if (!(await this.deps.appointments.updateStatus(atRisk, AppointmentStatus.PENDING))) continue;
      report.atRisk++;
      try {
        await this.deps.alerts.notifyAtRisk(atRisk);
      } catch {
        report.failed++;
      }
    }
  }

  /** C) Llegó su hora y sigue en riesgo: vence. */
  private async expireAtRisk(now: Date, report: CycleReport) {
    // Desde el principio: una cita en riesgo que ya terminó también debe vencer.
    for (const appointment of await this.deps.appointments.findByStatusFrom(AppointmentStatus.AT_RISK, new Date(0))) {
      if (appointment.slot.start > now) continue;
      const expired = appointment.changeStatus(AppointmentStatus.EXPIRED);
      if (await this.deps.appointments.updateStatus(expired, AppointmentStatus.AT_RISK)) report.expired++;
    }
  }
}

const minutesUntil = (appointment: Appointment, now: Date) => (appointment.slot.start.getTime() - now.getTime()) / MINUTE_MS;
