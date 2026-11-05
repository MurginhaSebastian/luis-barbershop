import { totalDuration } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";
import { type AvailabilityDeps, findFreeSlotsByBarber, loadBookableServices } from "./availability";

export interface GetAvailableSlotsInput {
  /** null = sin preferencia: horas en las que algún barbero está libre. */
  barberId: string | null;
  serviceIds: readonly string[];
  /** Día en el calendario de la barbería, "YYYY-MM-DD". */
  date: string;
}

export class GetAvailableSlotsUseCase {
  constructor(private readonly deps: AvailabilityDeps) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const services = await loadBookableServices(this.deps.services, input.serviceIds);
    const byBarber = await findFreeSlotsByBarber(this.deps, input.barberId, input.date, totalDuration(services));
    const byStart = new Map(byBarber.flatMap((b) => b.slots).map((slot) => [slot.start.getTime(), slot]));
    return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}
