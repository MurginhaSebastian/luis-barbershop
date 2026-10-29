import type { Service } from "@/core/entities/catalog";
import type { TimeSlot } from "@/core/entities/time-slot";
import { InvalidAppointmentError, NotFoundError } from "@/core/errors/domain-errors";
import { availableSlots, shopDayRange, shopWeekday } from "@/core/scheduling/availability";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";

export interface AvailabilityDeps {
  barbers: IBarberRepository;
  services: IServiceRepository;
  schedule: IScheduleRepository;
  appointments: IAppointmentRepository;
  now: () => Date;
}

/** Servicios pedidos (sin repetir), en el orden pedido; todos deben existir y estar activos. */
export async function loadBookableServices(repo: IServiceRepository, ids: readonly string[]): Promise<Service[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new InvalidAppointmentError("Elige al menos un servicio.");
  const found = await repo.findByIds(unique);
  return unique.map((id) => {
    const service = found.find((s) => s.id === id);
    if (!service?.active) throw new NotFoundError("Servicio", id);
    return service;
  });
}

export async function findFreeSlots(
  deps: AvailabilityDeps,
  barberId: string,
  date: string,
  durationMinutes: number,
): Promise<TimeSlot[]> {
  const barber = await deps.barbers.findById(barberId);
  if (!barber?.active) throw new NotFoundError("Barbero", barberId);

  const range = shopDayRange(date);
  const [hours, blocks, appointments] = await Promise.all([
    deps.schedule.findBusinessHours(shopWeekday(date)),
    deps.schedule.findBlocks(barberId, range),
    deps.appointments.findByBarberInRange(barberId, range),
  ]);
  const busy = [...blocks, ...appointments.filter((a) => a.blocksSchedule()).map((a) => a.slot)];
  return availableSlots({ date, hours, busy, durationMinutes, now: deps.now() });
}
