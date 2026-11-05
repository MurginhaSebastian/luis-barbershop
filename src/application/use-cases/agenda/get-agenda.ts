import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import { type Appointment, AppointmentStatus } from "@/core/entities/appointment";
import { shopDayRange } from "@/core/scheduling/availability";

/** Lo que el barbero necesita ver de una cita, en datos planos para la pantalla. */
export interface AgendaItem {
  id: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  customerName: string;
  phone: string;
  barberName: string;
  services: string[];
  products: string[];
  totalCents: number;
}

export interface Agenda {
  /** Todas las citas futuras que aún nadie ha confirmado, de cualquier día. */
  pending: AgendaItem[];
  day: AgendaItem[];
}

export interface GetAgendaDeps {
  appointments: IAppointmentRepository;
  customers: ICustomerRepository;
  barbers: IBarberRepository;
  now: () => Date;
}

export class GetAgendaUseCase {
  constructor(private readonly deps: GetAgendaDeps) {}

  async execute({ date }: { date: string }): Promise<Agenda> {
    const [pending, day] = await Promise.all([
      this.deps.appointments.findByStatusFrom(AppointmentStatus.PENDING, this.deps.now()),
      this.deps.appointments.findInRange(shopDayRange(date)),
    ]);
    const all = [...pending, ...day];
    const [customers, barbers] = await Promise.all([
      this.deps.customers.findByIds([...new Set(all.map((a) => a.customerId))]),
      this.deps.barbers.findByIds([...new Set(all.map((a) => a.barberId))]),
    ]);

    const toItems = (appointments: Appointment[]): AgendaItem[] =>
      appointments
        .toSorted((a, b) => a.slot.start.getTime() - b.slot.start.getTime())
        .map((a) => ({
          id: a.id,
          start: a.slot.start.toISOString(),
          end: a.slot.end.toISOString(),
          status: a.status,
          customerName: a.customerName,
          phone: customers.find((c) => c.id === a.customerId)?.phone ?? "",
          barberName: barbers.find((b) => b.id === a.barberId)?.name ?? "",
          services: a.services.map((s) => s.name),
          products: a.products.map((p) => `${p.quantity} × ${p.name}`),
          totalCents: a.totalCents,
        }));

    return { pending: toItems(pending), day: toItems(day) };
  }
}
