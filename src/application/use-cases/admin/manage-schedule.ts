import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
import { assertValidHours } from "@/core/catalog/rules";
import type { TimeSlot } from "@/core/entities/time-slot";
import { InvalidCatalogError, NotFoundError } from "@/core/errors/domain-errors";
import type { BusinessHours } from "@/core/scheduling/availability";

export interface BlockItem {
  id: string;
  /** null = toda la barbería. */
  barberName: string | null;
  start: string;
  end: string;
  reason: string | null;
}

export interface ManageScheduleDeps {
  schedule: IScheduleRepository;
  appointments: IAppointmentRepository;
  barbers: IBarberRepository;
  now: () => Date;
}

export class ManageScheduleUseCase {
  constructor(private readonly deps: ManageScheduleDeps) {}

  /** Índice 0 = domingo. */
  getWeeklyHours(): Promise<BusinessHours[][]> {
    return Promise.all([0, 1, 2, 3, 4, 5, 6].map((weekday) => this.deps.schedule.findBusinessHours(weekday)));
  }

  async saveDayHours(weekday: number, hours: readonly BusinessHours[]): Promise<void> {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new InvalidCatalogError("El día no es válido.");
    assertValidHours(hours);
    await this.deps.schedule.saveBusinessHours(weekday, hours);
  }

  async listBlocks(): Promise<BlockItem[]> {
    const blocks = await this.deps.schedule.findBlocksFrom(this.deps.now());
    const ids = blocks.flatMap((b) => (b.barberId ? [b.barberId] : []));
    const barbers = await this.deps.barbers.findByIds([...new Set(ids)]);
    return blocks
      .toSorted((a, b) => a.slot.start.getTime() - b.slot.start.getTime())
      .map((b) => ({
        id: b.id,
        barberName: barbers.find((x) => x.id === b.barberId)?.name ?? null,
        start: b.slot.start.toISOString(),
        end: b.slot.end.toISOString(),
        reason: b.reason,
      }));
  }

  /** Devuelve cuántas citas ya reservadas pisa el bloqueo: no se cancelan solas, las decide el barbero. */
  async addBlock(input: { barberId: string | null; slot: TimeSlot; reason: string | null }): Promise<{ conflicts: number }> {
    if (input.slot.end <= this.deps.now()) throw new InvalidCatalogError("Ese periodo ya pasó.");
    if (input.barberId && !(await this.deps.barbers.findById(input.barberId))) throw new NotFoundError("El barbero");

    await this.deps.schedule.addBlock({ ...input, id: crypto.randomUUID() });
    const appointments = await this.deps.appointments.findInRange(input.slot);
    const affected = appointments.filter((a) => a.blocksSchedule() && (!input.barberId || a.barberId === input.barberId));
    return { conflicts: affected.length };
  }

  removeBlock(id: string): Promise<void> {
    return this.deps.schedule.removeBlock(id);
  }
}
