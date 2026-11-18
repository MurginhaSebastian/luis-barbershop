import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
import { type Appointment, AppointmentStatus } from "@/core/entities/appointment";
import { TimeSlot } from "@/core/entities/time-slot";
import { addDays, shopDayRange, shopInstant, shopWeekday } from "@/core/scheduling/availability";

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
  /** Si está pendiente de confirmar por WhatsApp: hasta cuándo (ISO). Después queda en riesgo. */
  confirmBy?: string;
}

/** Un tramo del día, en ISO. */
export interface Interval {
  start: string;
  end: string;
}

export interface Agenda {
  /** Todas las citas futuras que aún nadie ha confirmado, de cualquier día. */
  pending: AgendaItem[];
  view: AgendaView;
  /** Fechas visibles "YYYY-MM-DD", en orden (1, 7 o 35/42). */
  days: string[];
  /** Citas que se cruzan con el rango visible, en cualquier estado, ordenadas por inicio. */
  items: AgendaItem[];
  /** Tramos de apertura de cada día visible. */
  open: (Interval & { date: string })[];
  /** Bloqueos del rango por barbero activo (los de toda la barbería aparecen en cada uno). */
  blocks: (Interval & { barberName: string })[];
}

export type AgendaView = "dia" | "semana" | "mes";

/** Lunes (inclusive) de la semana de esa fecha. */
const mondayOf = (date: string) => addDays(date, -((shopWeekday(date) + 6) % 7));

function visibleDays(date: string, view: AgendaView): string[] {
  if (view === "dia") return [date];
  let first = mondayOf(date);
  let last = addDays(first, 6);
  if (view === "mes") {
    const monthStart = `${date.slice(0, 8)}01`;
    const monthEnd = addDays(`${addDays(`${date.slice(0, 8)}28`, 4).slice(0, 8)}01`, -1);
    first = mondayOf(monthStart);
    last = addDays(mondayOf(monthEnd), 6);
  }
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  return days;
}

export interface GetAgendaDeps {
  appointments: IAppointmentRepository;
  customers: ICustomerRepository;
  barbers: IBarberRepository;
  confirmations: IConfirmationRepository;
  schedule: IScheduleRepository;
  now: () => Date;
}

export class GetAgendaUseCase {
  constructor(private readonly deps: GetAgendaDeps) {}

  async execute({ date, view = "dia" }: { date: string; view?: AgendaView }): Promise<Agenda> {
    const days = visibleDays(date, view);
    const range = TimeSlot.create(shopDayRange(days[0]).start, shopDayRange(days[days.length - 1]).end);
    const [pending, atRisk, inRange] = await Promise.all([
      this.deps.appointments.findByStatusFrom(AppointmentStatus.PENDING, this.deps.now()),
      this.deps.appointments.findByStatusFrom(AppointmentStatus.AT_RISK, this.deps.now()),
      this.deps.appointments.findInRange(range),
    ]);
    const all = [...pending, ...atRisk, ...inRange];
    const [customers, barbers, confirmations] = await Promise.all([
      this.deps.customers.findByIds([...new Set(all.map((a) => a.customerId))]),
      this.deps.barbers.findByIds([...new Set(all.map((a) => a.barberId))]),
      this.deps.confirmations.findByAppointments(
        all.filter((a) => a.status === AppointmentStatus.PENDING).map((a) => a.id),
      ),
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
          ...(a.status === AppointmentStatus.PENDING && {
            confirmBy: confirmations.find((c) => c.appointmentId === a.id)?.confirmBy.toISOString(),
          }),
        }));

    const weekdays = [...new Set(days.map(shopWeekday))];
    const [hoursByWeekday, activeBarbers] = await Promise.all([
      Promise.all(weekdays.map((w) => this.deps.schedule.findBusinessHours(w))),
      this.deps.barbers.findAllActive(),
    ]);
    const open = days.flatMap((d) =>
      hoursByWeekday[weekdays.indexOf(shopWeekday(d))].map((h) => ({
        date: d,
        start: shopInstant(d, h.openMinute).toISOString(),
        end: shopInstant(d, h.closeMinute).toISOString(),
      })),
    );
    const blocks = await Promise.all(
      activeBarbers.map(async (barber) =>
        (await this.deps.schedule.findBlocks(barber.id, range)).map((b) => ({
          barberName: barber.name,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
        })),
      ),
    );
    return {
      pending: toItems([...pending, ...atRisk]),
      view,
      days,
      items: toItems(inRange),
      open,
      blocks: blocks.flat(),
    };
  }
}
