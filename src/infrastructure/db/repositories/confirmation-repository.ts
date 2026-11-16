import { eq, inArray } from "drizzle-orm";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import type { Db } from "../client";
import { bookingConfirmations } from "../schema";

const columns = {
  appointmentId: bookingConfirmations.appointmentId,
  code: bookingConfirmations.code,
  confirmBy: bookingConfirmations.confirmBy,
};

export class DrizzleConfirmationRepository implements IConfirmationRepository {
  constructor(private readonly db: Db) {}

  async save(confirmation: BookingConfirmation): Promise<void> {
    await this.db
      .insert(bookingConfirmations)
      .values(confirmation)
      .onConflictDoUpdate({
        target: bookingConfirmations.appointmentId,
        set: { code: confirmation.code, confirmBy: confirmation.confirmBy },
      });
  }

  findByCode(code: string): Promise<BookingConfirmation[]> {
    return this.db.select(columns).from(bookingConfirmations).where(eq(bookingConfirmations.code, code));
  }

  async findByAppointments(appointmentIds: readonly string[]): Promise<BookingConfirmation[]> {
    if (appointmentIds.length === 0) return [];
    return this.db
      .select(columns)
      .from(bookingConfirmations)
      .where(inArray(bookingConfirmations.appointmentId, [...appointmentIds]));
  }
}
