/** Resultado de enviar el formulario de reserva, tal como lo muestra la UI. */
export type BookingState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>>; slotTaken?: boolean }
  | { status: "ok"; start: string; totalCents: number; barberId: string };

export type BookingAction = (prev: BookingState, form: FormData) => Promise<BookingState>;
