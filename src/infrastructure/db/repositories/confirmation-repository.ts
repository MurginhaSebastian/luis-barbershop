import { and, eq, lte } from "drizzle-orm";
import type { IConfirmationRepository } from "@/application/ports/repositories/confirmation-repository";
import type { BookingConfirmation } from "@/core/entities/confirmation";
import type { Db } from "../client";
import { appointments, bookingConfirmations } from "../schema";

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

  findOverdue(now: Date): Promise<BookingConfirmation[]> {
    return this.db
      .select(columns)
      .from(bookingConfirmations)
      .innerJoin(appointments, eq(appointments.id, bookingConfirmations.appointmentId))
      .where(and(eq(appointments.status, "PENDING"), lte(bookingConfirmations.confirmBy, now)));
  }

  async findByAppointment(appointmentId: string): Promise<BookingConfirmation | null> {
    const [row] = await this.db
      .select(columns)
      .from(bookingConfirmations)
      .where(eq(bookingConfirmations.appointmentId, appointmentId));
    return row ?? null;
  }
}
