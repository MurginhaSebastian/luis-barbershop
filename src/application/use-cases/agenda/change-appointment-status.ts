import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { InvalidStatusChangeError, NotFoundError } from "@/core/errors/domain-errors";

export class ChangeAppointmentStatusUseCase {
  constructor(private readonly deps: { appointments: IAppointmentRepository }) {}

  async execute({ id, status }: { id: string; status: AppointmentStatus }): Promise<void> {
    const appointment = await this.deps.appointments.findById(id);
    if (!appointment) throw new NotFoundError("La cita");
    // Si cambió mientras tanto (el cliente confirmó o venció), no se pisa: el barbero recarga y decide.
    const changed = await this.deps.appointments.updateStatus(appointment.changeStatus(status), appointment.status);
    if (!changed) throw new InvalidStatusChangeError();
  }
}
