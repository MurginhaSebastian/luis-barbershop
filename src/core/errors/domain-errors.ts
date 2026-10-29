export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTimeSlotError extends DomainError {}

export class InvalidDateError extends DomainError {}

export class SlotUnavailableError extends DomainError {
  constructor() {
    super("El horario elegido ya no está disponible.");
  }
}

export class BookingWindowError extends DomainError {}

export class InvalidAppointmentError extends DomainError {}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} no encontrado: ${id}`);
  }
}
