import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { NotFoundError } from "@/core/errors/domain-errors";

export class ChangeAppointmentStatusUseCase {
  constructor(private readonly deps: { appointments: IAppointmentRepository }) {}

  async execute({ id, status }: { id: string; status: AppointmentStatus }): Promise<void> {
    const appointment = await this.deps.appointments.findById(id);
    if (!appointment) throw new NotFoundError("La cita");
    await this.deps.appointments.save(appointment.changeStatus(status));
  }
}
