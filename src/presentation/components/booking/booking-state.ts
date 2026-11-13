/** Resultado de enviar el formulario de reserva, tal como lo muestra la UI. */
export type BookingState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>>; slotTaken?: boolean }
  | {
      status: "ok";
      start: string;
      totalCents: number;
      barberId: string;
      /** Si hay que confirmarla por WhatsApp: el código, hasta cuándo (ISO) y a qué número escribir. */
      confirmation?: { code: string; confirmBy: string; whatsapp: string };
    };

export type BookingAction = (prev: BookingState, form: FormData) => Promise<BookingState>;
