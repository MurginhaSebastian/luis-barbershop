import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import { Appointment } from "@/core/entities/appointment";
import { TimeSlot } from "@/core/entities/time-slot";
import { SlotUnavailableError } from "@/core/errors/domain-errors";
import type { Db } from "../client";
import { appointmentProducts, appointments, appointmentServices } from "../schema";

const EXCLUSION_VIOLATION = "23P01";

/** Drizzle envuelve el error de pg en `cause`: se recorre la cadena buscando el código. */
function isOverlapViolation(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: string }).code === EXCLUSION_VIOLATION) return true;
  }
  return false;
}

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly db: Db) {}

  async findByBarberInRange(barberId: string, range: TimeSlot): Promise<Appointment[]> {
    const rows = await this.db
      .select()
      .from(appointments)
      .where(
        and(eq(appointments.barberId, barberId), lt(appointments.startsAt, range.end), gt(appointments.endsAt, range.start)),
      );
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const [serviceRows, productRows] = await Promise.all([
      this.db
        .select()
        .from(appointmentServices)
        .where(inArray(appointmentServices.appointmentId, ids))
        .orderBy(asc(appointmentServices.position)),
      this.db
        .select()
        .from(appointmentProducts)
        .where(inArray(appointmentProducts.appointmentId, ids))
        .orderBy(asc(appointmentProducts.position)),
    ]);

    return rows.map((r) =>
      Appointment.restore({
        id: r.id,
        barberId: r.barberId,
        customerId: r.customerId,
        slot: TimeSlot.create(r.startsAt, r.endsAt),
        status: r.status,
        services: serviceRows
          .filter((s) => s.appointmentId === r.id)
          .map(({ serviceId, name, durationMinutes, priceCents }) => ({ serviceId, name, durationMinutes, priceCents })),
        products: productRows
          .filter((p) => p.appointmentId === r.id)
          .map(({ productId, name, quantity, unitPriceCents }) => ({ productId, name, quantity, unitPriceCents })),
      }),
    );
  }

  /** Inserta o actualiza la cita y reemplaza sus líneas, todo en una transacción. */
  async save(appointment: Appointment): Promise<void> {
    const row = {
      id: appointment.id,
      barberId: appointment.barberId,
      customerId: appointment.customerId,
      startsAt: appointment.slot.start,
      endsAt: appointment.slot.end,
      status: appointment.status,
    };
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(appointments)
          .values(row)
          .onConflictDoUpdate({
            target: appointments.id,
            set: { startsAt: row.startsAt, endsAt: row.endsAt, status: row.status },
          });
        await tx.delete(appointmentServices).where(eq(appointmentServices.appointmentId, appointment.id));
        await tx.delete(appointmentProducts).where(eq(appointmentProducts.appointmentId, appointment.id));
        await tx
          .insert(appointmentServices)
          .values(appointment.services.map((s, position) => ({ ...s, appointmentId: appointment.id, position })));
        if (appointment.products.length > 0) {
          await tx
            .insert(appointmentProducts)
            .values(appointment.products.map((p, position) => ({ ...p, appointmentId: appointment.id, position })));
        }
      });
    } catch (error) {
      if (isOverlapViolation(error)) throw new SlotUnavailableError();
      throw error;
    }
  }
}
