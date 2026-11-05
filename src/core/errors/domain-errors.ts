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

export class TooManyActiveAppointmentsError extends DomainError {
  constructor(limit: number) {
    super(`Este celular ya tiene ${limit} citas por venir. Escríbenos por WhatsApp si necesitas otra.`);
  }
}

export class InvalidAppointmentError extends DomainError {}

export class InvalidStatusChangeError extends DomainError {
  constructor() {
    super("Esta cita ya no admite ese cambio. Actualiza la agenda.");
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} ya no está disponible. Vuelve a elegir, por favor.`);
  }
}
