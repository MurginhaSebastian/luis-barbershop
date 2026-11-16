import type { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  /** Citas de todos los barberos que se cruzan con el rango, en cualquier estado. */
  findInRange(range: TimeSlot): Promise<Appointment[]>;
  /** Citas en ese estado que aún no han terminado en ese instante. */
  findByStatusFrom(status: AppointmentStatus, from: Date): Promise<Appointment[]>;
  /** Citas del barbero que se cruzan con el rango, en cualquier estado: el dominio decide cuáles bloquean. */
  findByBarberInRange(barberId: string, range: TimeSlot): Promise<Appointment[]>;
  /** Citas del cliente que aún no han terminado en ese instante, en cualquier estado. */
  findByCustomerFrom(customerId: string, from: Date): Promise<Appointment[]>;
  /**
   * Debe lanzar SlotUnavailableError si otra cita ocupó el hueco entre la comprobación y el guardado.
   * `displacing`: citas en riesgo cuyo hueco toma esta. En la misma transacción pasan de AT_RISK a EXPIRED; si
   * alguna ya cambió (su cliente confirmó justo antes), lanza SlotUnavailableError y no guarda nada.
   */
  save(appointment: Appointment, displacing?: readonly Appointment[]): Promise<void>;
  /**
   * Guarda el nuevo estado solo si la cita sigue en `expected`; false si otro la cambió antes (el cliente
   * confirmó mientras vencía, o el barbero canceló a la vez). Así un cambio nunca pisa a otro.
   */
  updateStatus(next: Appointment, expected: AppointmentStatus): Promise<boolean>;
  /** Marca el aviso de -35 min como enviado si la cita sigue PENDING y sin marcar; false si ya lo estaba. */
  claimReminder(id: string, at: Date): Promise<boolean>;
  /** Quita la marca (el aviso no salió): el próximo ciclo lo reintenta. */
  releaseReminder(id: string): Promise<void>;
}
