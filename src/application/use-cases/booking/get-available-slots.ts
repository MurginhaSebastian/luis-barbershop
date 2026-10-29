import { totalDuration } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";
import { type AvailabilityDeps, findFreeSlots, loadBookableServices } from "./availability";

export interface GetAvailableSlotsInput {
  barberId: string;
  serviceIds: readonly string[];
  /** Día en el calendario de la barbería, "YYYY-MM-DD". */
  date: string;
}

export class GetAvailableSlotsUseCase {
  constructor(private readonly deps: AvailabilityDeps) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const services = await loadBookableServices(this.deps.services, input.serviceIds);
    return findFreeSlots(this.deps, input.barberId, input.date, totalDuration(services));
  }
}
