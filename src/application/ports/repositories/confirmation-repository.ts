import type { BookingConfirmation } from "@/core/entities/confirmation";

export interface IConfirmationRepository {
  /** Una por cita: volver a guardarla sustituye su código y su plazo. */
  save(confirmation: BookingConfirmation): Promise<void>;
  /** Las de ese código. Un código puede repetirse entre clientes: quien llama filtra por el que escribe. */
  findByCode(code: string): Promise<BookingConfirmation[]>;
  /** Las de citas aún pendientes cuyo plazo ya pasó en ese instante. */
  findOverdue(now: Date): Promise<BookingConfirmation[]>;
  /** La de una cita, si se pidió confirmación. */
  findByAppointment(appointmentId: string): Promise<BookingConfirmation | null>;
}
