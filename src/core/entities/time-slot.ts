import { InvalidTimeSlotError } from "../errors/domain-errors";

export const MINUTE_MS = 60_000;

/** Intervalo semiabierto [start, end): dos huecos que solo se tocan no se solapan. */
export class TimeSlot {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static create(start: Date, end: Date): TimeSlot {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new InvalidTimeSlotError("Fecha inválida en el intervalo.");
    }
    if (end <= start) {
      throw new InvalidTimeSlotError("El fin del intervalo debe ser posterior al inicio.");
    }
    return new TimeSlot(start, end);
  }

  static ofMinutes(start: Date, minutes: number): TimeSlot {
    return TimeSlot.create(start, new Date(start.getTime() + minutes * MINUTE_MS));
  }

  get durationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / MINUTE_MS;
  }

  overlaps(other: TimeSlot): boolean {
    return this.start < other.end && other.start < this.end;
  }
}
