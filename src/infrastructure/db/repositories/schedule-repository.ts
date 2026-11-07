import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
import type { ScheduleBlock } from "@/core/entities/catalog";
import { TimeSlot } from "@/core/entities/time-slot";
import type { BusinessHours } from "@/core/scheduling/availability";
import type { Db } from "../client";
import { businessHours, scheduleBlocks } from "../schema";

export class DrizzleScheduleRepository implements IScheduleRepository {
  constructor(private readonly db: Db) {}

  async findBusinessHours(weekday: number): Promise<BusinessHours[]> {
    return this.db
      .select({ openMinute: businessHours.openMinute, closeMinute: businessHours.closeMinute })
      .from(businessHours)
      .where(eq(businessHours.weekday, weekday))
      .orderBy(businessHours.openMinute);
  }

  async findBlocks(barberId: string, range: TimeSlot): Promise<TimeSlot[]> {
    const rows = await this.db
      .select({ startsAt: scheduleBlocks.startsAt, endsAt: scheduleBlocks.endsAt })
      .from(scheduleBlocks)
      .where(
        and(
          or(eq(scheduleBlocks.barberId, barberId), isNull(scheduleBlocks.barberId)),
          lt(scheduleBlocks.startsAt, range.end),
          gt(scheduleBlocks.endsAt, range.start),
        ),
      );
    return rows.map((r) => TimeSlot.create(r.startsAt, r.endsAt));
  }

  async saveBusinessHours(weekday: number, hours: readonly BusinessHours[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(businessHours).where(eq(businessHours.weekday, weekday));
      if (hours.length > 0) await tx.insert(businessHours).values(hours.map((h) => ({ ...h, weekday })));
    });
  }

  async findBlocksFrom(from: Date): Promise<ScheduleBlock[]> {
    const rows = await this.db.select().from(scheduleBlocks).where(gt(scheduleBlocks.endsAt, from));
    return rows.map((r) => ({
      id: r.id,
      barberId: r.barberId,
      slot: TimeSlot.create(r.startsAt, r.endsAt),
      reason: r.reason,
    }));
  }

  async addBlock({ id, barberId, slot, reason }: ScheduleBlock): Promise<void> {
    await this.db.insert(scheduleBlocks).values({ id, barberId, startsAt: slot.start, endsAt: slot.end, reason });
  }

  async removeBlock(id: string): Promise<void> {
    await this.db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, id));
  }
}
