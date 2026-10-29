import type { TimeSlot } from "@/core/entities/time-slot";
import type { BusinessHours } from "@/core/scheduling/availability";

export interface IScheduleRepository {
  /** Tramos de apertura de la barbería (comunes a todos los barberos); 0 = domingo. */
  findBusinessHours(weekday: number): Promise<BusinessHours[]>;
  /** Bloqueos del barbero más los de toda la barbería (feriados, cierres) que se cruzan con el rango. */
  findBlocks(barberId: string, range: TimeSlot): Promise<TimeSlot[]>;
}
