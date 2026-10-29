import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
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
}
