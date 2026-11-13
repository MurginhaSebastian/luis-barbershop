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
  /** Debe lanzar SlotUnavailableError si otra cita ocupó el hueco entre la comprobación y el guardado. */
  save(appointment: Appointment): Promise<void>;
  /**
   * Guarda el nuevo estado solo si la cita sigue en `expected`; false si otro la cambió antes (el cliente
   * confirmó mientras vencía, o el barbero canceló a la vez). Así un cambio nunca pisa a otro.
   */
  updateStatus(next: Appointment, expected: AppointmentStatus): Promise<boolean>;
}
