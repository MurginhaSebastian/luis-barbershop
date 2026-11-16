import { z } from "zod";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";
import { shopDateTime, shopIso, shopTime } from "@/application/shop-time";
import { type Appointment, AppointmentStatus, totalDuration } from "@/core/entities/appointment";
import { normalizePhone } from "@/core/entities/customer";
import type { TimeSlot } from "@/core/entities/time-slot";
import { DomainError } from "@/core/errors/domain-errors";
import { loadBookableServices } from "../booking/availability";
import type { GetAvailableSlotsUseCase } from "../booking/get-available-slots";
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

export type ToolError = "UNKNOWN_TOOL" | "INVALID_ARGUMENTS" | "DOMAIN_ERROR";

/** Siempre JSON plano: ids y datos de las citas del propio cliente, nunca de otros. */
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ToolError; message: string; data?: unknown };

export interface BotToolDeps {
  services: IServiceRepository;
  barbers: IBarberRepository;
  customers: ICustomerRepository;
  appointments: IAppointmentRepository;
  availability: Pick<GetAvailableSlotsUseCase, "execute">;
}

const ACTIVE: readonly AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.AT_RISK];

const fail = (error: ToolError, message: string, data?: unknown): ToolResult => ({ ok: false, error, message, ...(data !== undefined && { data }) });

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
        return this.freeSlots(args as z.infer<(typeof BOT_TOOLS)[typeof name]["schema"]>);
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
        barbers: barbers.map(({ id, name }) => ({ id, name })),
        myActiveAppointments: await this.views(mine),
      },
    };
  }

  private async freeSlots(args: { serviceIds: string[]; date: string; barberId?: string | null }): Promise<ToolResult> {
    const services = await loadBookableServices(this.deps.services, args.serviceIds);
    const slots = await this.deps.availability.execute({ barberId: args.barberId ?? null, serviceIds: args.serviceIds, date: args.date });
    return {
      ok: true,
      data: { date: args.date, totalDurationMinutes: totalDuration(services), slots: slots.map(slotView) },
    };
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

const slotView = (slot: TimeSlot) => ({ startTime: shopIso(slot.start), time: shopTime(slot.start) });
