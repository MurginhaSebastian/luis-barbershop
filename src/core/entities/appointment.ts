import { InvalidAppointmentError, InvalidStatusChangeError } from "../errors/domain-errors";
import { BORN_CONFIRMED_UNDER_MINUTES, CUSTOMER_CANCEL_MIN_MINUTES } from "../scheduling/booking-policy";
import { MINUTE_MS, TimeSlot } from "./time-slot";

export const AppointmentStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  /** Liberación condicional: faltan 15 min y no confirmó. Sigue siendo suya, pero otro cliente puede tomar el hueco. */
  AT_RISK: "AT_RISK",
  /** Nadie la confirmó a tiempo o otro cliente tomó su hueco en riesgo. */
  EXPIRED: "EXPIRED",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

// Debe coincidir con el WHERE de appointments_no_overlap (migración 0009). Una cita en riesgo no bloquea.
const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]);

// Una cita cancelada o vencida no se reabre: su hora ya podría ser de otro cliente. Una confirmada no vence.
const ALLOWED_CHANGES: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW", "AT_RISK", "EXPIRED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  // Confirma tarde (si nadie tomó el hueco), llega igual o se pierde.
  AT_RISK: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
};

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
  /** Quien reservó, tal como lo escribió: un celular lo puede usar más de una persona. */
  customerName: string;
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
    readonly customerName: string,
    readonly slot: TimeSlot,
    readonly status: AppointmentStatus,
    readonly services: readonly ServiceLine[],
    readonly products: readonly ProductLine[],
  ) {}

  /**
   * Nueva reserva: dura la suma de sus servicios. Nace PENDING si se reserva con 2 h o más de antelación y
   * CONFIRMED si es con menos (el "cazador de huecos" no tiene tiempo de confirmar: ya viene).
   */
  static book(input: Omit<AppointmentProps, "slot" | "status"> & { start: Date; bookedAt: Date }): Appointment {
    if (input.services.length === 0) {
      throw new InvalidAppointmentError("La cita necesita al menos un servicio.");
    }
    if (input.products.some((p) => !Number.isInteger(p.quantity) || p.quantity < 1)) {
      throw new InvalidAppointmentError("La cantidad de cada producto debe ser un entero positivo.");
    }
    const slot = TimeSlot.ofMinutes(input.start, totalDuration(input.services));
    const soon = input.start.getTime() - input.bookedAt.getTime() < BORN_CONFIRMED_UNDER_MINUTES * MINUTE_MS;
    return Appointment.restore({ ...input, slot, status: soon ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING });
  }

  /** Reconstruye una cita ya persistida (uso de los repositorios). */
  static restore(p: AppointmentProps): Appointment {
    return new Appointment(p.id, p.barberId, p.customerId, p.customerName, p.slot, p.status, p.services, p.products);
  }

  changeStatus(status: AppointmentStatus): Appointment {
    if (!ALLOWED_CHANGES[this.status].includes(status)) throw new InvalidStatusChangeError();
    return Appointment.restore({ ...this, status });
  }

  /**
   * ¿Puede cancelarla el propio cliente? Con 35 min o más de antelación, sí. Con menos, solo si aún no la había
   * confirmado (responde "no podré ir" al aviso de -35 min); una confirmada, ya no: debe avisar a la barbería.
   */
  customerCanCancel(now: Date): boolean {
    const minutesLeft = (this.slot.start.getTime() - now.getTime()) / MINUTE_MS;
    if (minutesLeft >= CUSTOMER_CANCEL_MIN_MINUTES) return ALLOWED_CHANGES[this.status].includes(AppointmentStatus.CANCELLED);
    return (this.status === AppointmentStatus.PENDING || this.status === AppointmentStatus.AT_RISK) && minutesLeft > 0;
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
