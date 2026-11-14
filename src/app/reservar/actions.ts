"use server";

import { after } from "next/server";
import { z } from "zod";
import type { Appointment } from "@/core/entities/appointment";
import { DomainError, SlotUnavailableError } from "@/core/errors/domain-errors";
import { getUseCases } from "@/infrastructure/container";
import type { BookingState } from "@/presentation/components/booking/booking-state";
import { parseBookingForm } from "./booking-schema";

// Acción pública (el cliente reserva sin cuenta): no hay sesión que comprobar, solo validar la entrada.
export async function createAppointmentAction(_prev: BookingState, form: FormData): Promise<BookingState> {
  const parsed = parseBookingForm(form);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: "error",
      message: "Revisa los datos marcados.",
      fieldErrors: Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])),
    };
  }

  const { name, phone, ...booking } = parsed.data;
  try {
    const { createAppointment, managePush } = getUseCases();
    const appointment = await createAppointment.execute({ ...booking, customer: { name, phone } });
    const confirmation = await requestConfirmation(appointment);
    // Después de responder: el cliente no espera al aviso y un aviso fallido no deshace la reserva.
    after(async () => {
      try {
        const report = await managePush.notifyNewBooking(appointment);
        if (report.failed > 0) console.error("aviso de reserva", report);
      } catch (error) {
        console.error("aviso de reserva", error);
      }
    });
    return {
      status: "ok",
      start: appointment.slot.start.toISOString(),
      totalCents: appointment.totalCents,
      barberId: appointment.barberId,
      confirmation: confirmation ?? undefined,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, slotTaken: error instanceof SlotUnavailableError };
    }
    console.error("createAppointmentAction", error);
    return { status: "error", message: "No pudimos registrar tu reserva. Inténtalo de nuevo en unos minutos." };
  }
}

/** Código y plazo para confirmar por WhatsApp. Si algo falla, la reserva sigue en pie y la confirma Luis. */
async function requestConfirmation(appointment: Appointment): Promise<NonNullable<BookingStateOk["confirmation"]> | null> {
  try {
    const { bookingConfirmation } = getUseCases();
    const issued = await bookingConfirmation.issue(appointment);
    const whatsapp = bookingConfirmation.confirmationNumber;
    return issued && whatsapp ? { code: issued.code, confirmBy: issued.confirmBy.toISOString(), whatsapp } : null;
  } catch (error) {
    console.error("confirmación por WhatsApp", error);
    return null;
  }
}

type BookingStateOk = Extract<BookingState, { status: "ok" }>;
