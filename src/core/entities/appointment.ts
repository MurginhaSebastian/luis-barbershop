import { InvalidAppointmentError } from "../errors/domain-errors";
import { TimeSlot } from "./time-slot";

export const AppointmentStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
]);

/** Foto del servicio al reservar: si luego cambia el precio, la cita conserva el suyo. */
export interface ServiceLine {
  serviceId: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

export interface ProductLine {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface AppointmentProps {
  id: string;
  barberId: string;
  customerId: string;
  slot: TimeSlot;
  status: AppointmentStatus;
  services: readonly ServiceLine[];
  products: readonly ProductLine[];
}

export class Appointment {
  private constructor(
    readonly id: string,
    readonly barberId: string,
    readonly customerId: string,
    readonly slot: TimeSlot,
    readonly status: AppointmentStatus,
    readonly services: readonly ServiceLine[],
    readonly products: readonly ProductLine[],
  ) {}

  /** Nueva reserva: nace PENDING y dura la suma de sus servicios. */
  static book(input: Omit<AppointmentProps, "slot" | "status"> & { start: Date }): Appointment {
    if (input.services.length === 0) {
      throw new InvalidAppointmentError("La cita necesita al menos un servicio.");
    }
    if (input.products.some((p) => !Number.isInteger(p.quantity) || p.quantity < 1)) {
      throw new InvalidAppointmentError("La cantidad de cada producto debe ser un entero positivo.");
    }
    const slot = TimeSlot.ofMinutes(input.start, totalDuration(input.services));
    return Appointment.restore({ ...input, slot, status: AppointmentStatus.PENDING });
  }

  /** Reconstruye una cita ya persistida (uso de los repositorios). */
  static restore(p: AppointmentProps): Appointment {
    return new Appointment(p.id, p.barberId, p.customerId, p.slot, p.status, p.services, p.products);
  }

  blocksSchedule(): boolean {
    return BLOCKING_STATUSES.has(this.status);
  }

  get totalCents(): number {
    return (
      this.services.reduce((sum, s) => sum + s.priceCents, 0) +
      this.products.reduce((sum, p) => sum + p.unitPriceCents * p.quantity, 0)
    );
  }
}

export function totalDuration(services: readonly { durationMinutes: number }[]): number {
  return services.reduce((sum, s) => sum + s.durationMinutes, 0);
}
