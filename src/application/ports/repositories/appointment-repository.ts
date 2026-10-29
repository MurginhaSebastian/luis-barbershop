import type { Appointment } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";

export interface IAppointmentRepository {
  /** Citas del barbero que se cruzan con el rango, en cualquier estado: el dominio decide cuáles bloquean. */
  findByBarberInRange(barberId: string, range: TimeSlot): Promise<Appointment[]>;
  /** Debe lanzar SlotUnavailableError si otra cita ocupó el hueco entre la comprobación y el guardado. */
  save(appointment: Appointment): Promise<void>;
}
