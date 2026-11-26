import { z } from "zod";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";
import { shopDateTime, shopIso, shopTime } from "@/application/shop-time";
import { type Appointment, AppointmentStatus, totalDuration } from "@/core/entities/appointment";
import { ownerLast } from "@/core/entities/catalog";
import { normalizePhone } from "@/core/entities/customer";
import { shopDateOf } from "@/core/scheduling/availability";
import { CUSTOMER_CANCEL_MIN_MINUTES } from "@/core/scheduling/booking-policy";
import type { TimeSlot } from "@/core/entities/time-slot";
import { DomainError } from "@/core/errors/domain-errors";
import { loadBookableServices } from "../booking/availability";
import type { BookingConfirmationUseCase } from "../booking/booking-confirmation";
import type { CreateAppointmentUseCase } from "../booking/create-appointment";
import type { GetAvailableSlotsUseCase } from "../booking/get-available-slots";
import type { ManagePushUseCase } from "../push/manage-push";
import { BOT_TOOLS, type BotToolName, isBotTool } from "./bot-tools";

export interface ToolCall {
  name: string;
  /** Lo que mandó el modelo, sin validar. */
  arguments: unknown;
}

/** Lo pone el servidor, nunca el modelo: el celular sale del remitente que Meta firmó. */
export interface ToolContext {
  verifiedPhone: string;
  now: Date;
}

export type ToolError =
  | "UNKNOWN_TOOL"
  | "INVALID_ARGUMENTS"
  | "DOMAIN_ERROR"
  /** No existe o es de otro número: la misma respuesta, para no revelar que existe. */
  | "APPOINTMENT_NOT_FOUND"
  | "NO_ACTIVE_APPOINTMENTS"
  /** No tiene nada por confirmar: ni pendientes, ni en riesgo, ni una vencida cuya hora tomó otro. */
  | "NO_APPOINTMENTS_TO_CONFIRM"
  /** Tiene varias citas y no dijo cuál: el modelo debe preguntarle (vienen en data.appointments). */
  | "MULTIPLE_APPOINTMENTS_FOUND"
  /** Estaba en riesgo y otro cliente tomó la hora: en data.nextSlots, las siguientes libres de ese día. */
  | "SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER"
  | "CANCELLATION_TOO_LATE"
  | "APPOINTMENT_NOT_ACTIVE";

/**
 * Siempre JSON plano: ids y datos de las citas del propio cliente, nunca de otros. `failedNotices`: avisos al
 * barbero o a otros clientes que no salieron; la operación vale igual (el adaptador lo registra, no el modelo).
 */
export type ToolResult =
  | { ok: true; data: unknown; failedNotices?: number }
  | { ok: false; error: ToolError; message: string; data?: unknown };

export interface BotToolDeps {
  services: IServiceRepository;
  barbers: IBarberRepository;
  customers: ICustomerRepository;
  appointments: IAppointmentRepository;
  availability: Pick<GetAvailableSlotsUseCase, "execute" | "alternatives">;
  booking: Pick<CreateAppointmentUseCase, "execute">;
  confirmation: Pick<BookingConfirmationUseCase, "issue" | "confirm" | "cancel" | "notifyReleased">;
  push: Pick<ManagePushUseCase, "notifyNewBooking" | "notifyConfirmed" | "notifyCancelled">;
}

type Args<T extends BotToolName> = z.infer<(typeof BOT_TOOLS)[T]["schema"]>;

const ACTIVE: readonly AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.AT_RISK];

const fail = (error: ToolError, message: string, data?: unknown): ToolResult => ({ ok: false, error, message, ...(data !== undefined && { data }) });
const done = (data: unknown, failedNotices: number): ToolResult => ({ ok: true, data, ...(failedNotices > 0 && { failedNotices }) });

/**
 * Ejecuta las herramientas que pide el asistente de IA con las mismas reglas que la web. Valida los argumentos
 * del modelo (frontera de confianza) y traduce los errores de negocio a resultados que el modelo puede explicar.
 */
export class BotToolExecutor {
  constructor(private readonly deps: BotToolDeps) {}

  async executeTool(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    if (!isBotTool(call.name)) return fail("UNKNOWN_TOOL", `No existe la herramienta ${call.name}.`);
    const parsed = BOT_TOOLS[call.name].schema.safeParse(call.arguments ?? {});
    if (!parsed.success) return fail("INVALID_ARGUMENTS", z.prettifyError(parsed.error));
    try {
      return await this.run(call.name, parsed.data, context);
    } catch (error) {
      if (error instanceof DomainError) return fail("DOMAIN_ERROR", error.message);
      throw error;
    }
  }

  private run(name: BotToolName, args: unknown, context: ToolContext): Promise<ToolResult> {
    switch (name) {
      case "listar_catalogo_y_mis_citas":
        return this.catalogAndMine(context);
      case "consultar_huecos_dinamicos":
        return this.freeSlots(args as Args<typeof name>);
      case "reservar_cita":
        return this.book(args as Args<typeof name>, context);
      case "confirmar_asistencia":
        return this.confirm(args as Args<typeof name>, context);
      case "cancelar_cita":
        return this.cancel(args as Args<typeof name>, context);
    }
  }

  /** Lo mismo que la reserva web (app/reservar/actions.ts): código si nace pendiente, y los mismos avisos. */
  private async book(args: Args<"reservar_cita">, context: ToolContext): Promise<ToolResult> {
    const { appointment, displaced } = await this.deps.booking.execute({
      barberId: args.barberId ?? null,
      serviceIds: args.serviceIds,
      customer: { name: args.customerName, phone: context.verifiedPhone },
      start: new Date(args.startTime),
    });
    const failed = await notices([
      // Sin código, el ciclo de -35 / -15 min no la vería: quedaría pendiente para siempre.
      () => this.deps.confirmation.issue(appointment).then(() => ({ failed: 0 })),
      () => this.deps.push.notifyNewBooking(appointment),
      () => this.deps.confirmation.notifyReleased(displaced),
    ]);
    const [view] = await this.views([appointment]);
    const next =
      appointment.status === AppointmentStatus.CONFIRMED
        ? "Quedó confirmada: faltan menos de 2 horas."
        : "Quedó pendiente: 35 minutos antes te escribiremos por WhatsApp para que confirmes.";
    return done({ appointment: view, next }, failed);
  }

  private async confirm(args: Args<"confirmar_asistencia">, context: ToolContext): Promise<ToolResult> {
    const target = await this.target(
      context,
      args.appointmentId,
      // Primero lo que se puede confirmar; si no hay, una vencida (solo vence tras estar en riesgo: se le dice que
      // otro tomó su hora) o una ya confirmada (se le dice que ya lo estaba).
      [[AppointmentStatus.PENDING, AppointmentStatus.AT_RISK], [AppointmentStatus.EXPIRED], [AppointmentStatus.CONFIRMED]],
      fail("NO_APPOINTMENTS_TO_CONFIRM", "No tienes ninguna cita pendiente por confirmar."),
    );
    if ("result" in target) return target.result;
    const outcome = await this.deps.confirmation.confirm(target.appointment);
    if (outcome.kind === "confirmed") {
      const failed = await notices([() => this.deps.push.notifyConfirmed(outcome.appointment)]);
      const [view] = await this.views([outcome.appointment]);
      return done({ appointment: view }, failed);
    }
    if (outcome.kind === "already-confirmed") {
      return done({ appointmentId: target.appointment.id, status: AppointmentStatus.CONFIRMED, note: "Ya estaba confirmada." }, 0);
    }
    if (outcome.kind === "slot-taken") {
      return fail("SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER", "No confirmó a tiempo y otro cliente tomó esa hora.", {
        nextSlots: await this.nextSlots(target.appointment, context.now),
      });
    }
    return fail("APPOINTMENT_NOT_ACTIVE", "Esa cita ya no está activa.");
  }

  private async cancel(args: Args<"cancelar_cita">, context: ToolContext): Promise<ToolResult> {
    const target = await this.target(context, args.appointmentId, [ACTIVE], fail("NO_ACTIVE_APPOINTMENTS", "Este número no tiene citas activas."));
    if ("result" in target) return target.result;
    const outcome = await this.deps.confirmation.cancel(target.appointment);
    if (outcome.kind === "cancelled") {
      const failed = await notices([() => this.deps.push.notifyCancelled(outcome.appointment)]);
      const [view] = await this.views([outcome.appointment]);
      return done({ appointmentId: outcome.appointment.id, status: AppointmentStatus.CANCELLED, appointment: view }, failed);
    }
    if (outcome.kind === "too-late") {
      return fail(
        "CANCELLATION_TOO_LATE",
        `Ya estaba confirmada y faltan menos de ${CUSTOMER_CANCEL_MIN_MINUTES} minutos: debe avisar directamente a la barbería.`,
      );
    }
    return fail("APPOINTMENT_NOT_ACTIVE", "Esa cita ya no está activa.");
  }

  /**
   * La cita sobre la que actuar, siempre del celular verificado. Con id, debe ser suya; sin id, la única del primer
   * grupo de estados que tenga alguna (si ninguno tiene, `none`). Con varias no se adivina: el modelo pregunta.
   */
  private async target(
    context: ToolContext,
    appointmentId: string | undefined,
    tiers: readonly (readonly AppointmentStatus[])[],
    none: ToolResult,
  ): Promise<{ appointment: Appointment } | { result: ToolResult }> {
    const customer = await this.deps.customers.findByPhone(normalizePhone(context.verifiedPhone));
    if (appointmentId) {
      const appointment = await this.deps.appointments.findById(appointmentId);
      return appointment && customer && appointment.customerId === customer.id
        ? { appointment }
        : { result: fail("APPOINTMENT_NOT_FOUND", "No encontramos esa cita entre las de este número.") };
    }
    const upcoming = customer ? await this.deps.appointments.findByCustomerFrom(customer.id, context.now) : [];
    const candidates =
      tiers
        .map((wanted) => upcoming.filter((a) => wanted.includes(a.status)))
        .find((found) => found.length > 0)
        ?.toSorted((a, b) => a.slot.start.getTime() - b.slot.start.getTime()) ?? [];
    if (candidates.length === 0) return { result: none };
    if (candidates.length > 1) {
      return {
        result: fail("MULTIPLE_APPOINTMENTS_FOUND", "Tiene varias citas: pregúntale cuál.", { appointments: await this.views(candidates) }),
      };
    }
    return { appointment: candidates[0] };
  }

  /** Las 3 siguientes horas libres de ese día, con los mismos servicios y barbero ([] si ya no se ofrecen). */
  private async nextSlots(appointment: Appointment, now: Date) {
    try {
      const slots = await this.deps.availability.execute({
        barberId: appointment.barberId,
        serviceIds: appointment.services.map((s) => s.serviceId),
        date: shopDateOf(appointment.slot.start),
      });
      return slots.filter((s) => s.start > now).slice(0, 3).map(slotView);
    } catch (error) {
      if (error instanceof DomainError) return [];
      throw error;
    }
  }

  private async catalogAndMine(context: ToolContext): Promise<ToolResult> {
    const [services, barbers, mine] = await Promise.all([
      this.deps.services.findAllActive(),
      this.deps.barbers.findAllActive(),
      this.activeAppointments(context),
    ]);
    return {
      ok: true,
      data: {
        services: services.map(({ id, name, durationMinutes, priceCents }) => ({
          id,
          name,
          durationMinutes,
          priceCents,
          price: `S/ ${(priceCents / 100).toFixed(2)}`,
        })),
        barbers: ownerLast(barbers).map(({ id, name, isOwner }) => ({ id, name, ...(isOwner && { isOwner }) })),
        myActiveAppointments: await this.views(mine),
      },
    };
  }

  private async freeSlots(args: { serviceIds: string[]; date: string; barberId?: string | null; franja?: "manana" | "tarde" }): Promise<ToolResult> {
    const services = await loadBookableServices(this.deps.services, args.serviceIds);
    const query = { barberId: args.barberId ?? null, serviceIds: args.serviceIds, date: args.date };
    const all = await this.deps.availability.execute(query);
    // La franja se filtra aquí y no en el prompt: el modelo mezclaba horas de la mañana con las de la tarde.
    const slots = args.franja ? all.filter((s) => (Number(shopTime(s.start).slice(0, 2)) >= AFTERNOON_FROM_HOUR) === (args.franja === "tarde")) : all;
    const base = { date: args.date, totalDurationMinutes: totalDuration(services), slots: slots.map(slotView) };
    if (slots.length > 0) return { ok: true, data: base };
    // Ese día sí hay horas, pero no en la franja pedida: se dicen aparte.
    if (all.length > 0) return { ok: true, data: { ...base, noSlotsInFranja: true, otherSlots: all.slice(0, 3).map(slotView) } };
    // Sin horas: otras opciones reservables en esta misma respuesta (máx. 3 horas cada una).
    const alt = await this.deps.availability.alternatives(query);
    const some = (list: TimeSlot[]) => list.slice(0, 3).map(slotView);
    const alternatives = {
      otherBarbers: alt.otherBarbers.map((b) => ({ barberId: b.barberId, name: b.name, slots: some(b.slots) })),
      nextFree: alt.nextFree && { date: alt.nextFree.date, slots: some(alt.nextFree.slots) },
    };
    return { ok: true, data: { ...base, alternatives } };
  }

  /** Citas futuras del celular verificado que aún cuentan: pendientes, confirmadas o en riesgo. */
  private async activeAppointments(context: ToolContext): Promise<Appointment[]> {
    const customer = await this.deps.customers.findByPhone(normalizePhone(context.verifiedPhone));
    if (!customer) return [];
    const upcoming = await this.deps.appointments.findByCustomerFrom(customer.id, context.now);
    return upcoming.filter((a) => ACTIVE.includes(a.status)).toSorted((a, b) => a.slot.start.getTime() - b.slot.start.getTime());
  }

  private async views(appointments: readonly Appointment[]) {
    const barbers = await this.deps.barbers.findByIds([...new Set(appointments.map((a) => a.barberId))]);
    return appointments.map((a) => ({
      id: a.id,
      startTime: shopIso(a.slot.start),
      endTime: shopIso(a.slot.end),
      when: shopDateTime(a.slot.start),
      status: a.status,
      barberName: barbers.find((b) => b.id === a.barberId)?.name ?? "",
      services: a.services.map((s) => s.name),
    }));
  }
}

/** Desde esta hora local, "tarde". */
const AFTERNOON_FROM_HOUR = 13;

const slotView = (slot: TimeSlot) => ({ startTime: shopIso(slot.start), time: shopTime(slot.start) });

/** Avisos tras la operación: un aviso fallido no la deshace; se cuentan para registrarlos. */
async function notices(tasks: (() => Promise<{ failed: number }>)[]): Promise<number> {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  return results.reduce((sum, r) => sum + (r.status === "rejected" ? 1 : r.value.failed), 0);
}
