import { Appointment, type ProductLine, totalDuration } from "@/core/entities/appointment";
import { type Customer, normalizePhone } from "@/core/entities/customer";
import { BookingWindowError, NotFoundError, SlotUnavailableError } from "@/core/errors/domain-errors";
import { bookingWindow, shopDateOf } from "@/core/scheduling/availability";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IProductRepository } from "@/application/ports/repositories/product-repository";
import { type AvailabilityDeps, findFreeSlotsByBarber, loadBookableServices } from "./availability";

export interface CreateAppointmentInput {
  /** null = sin preferencia: se asigna el barbero libre con menos carga ese día. */
  barberId: string | null;
  serviceIds: readonly string[];
  products?: readonly { productId: string; quantity: number }[];
  customer: { name: string; phone: string };
  start: Date;
}

export interface CreateAppointmentDeps extends AvailabilityDeps {
  customers: ICustomerRepository;
  products: IProductRepository;
}

export class CreateAppointmentUseCase {
  constructor(private readonly deps: CreateAppointmentDeps) {}

  async execute(input: CreateAppointmentInput): Promise<Appointment> {
    const services = await loadBookableServices(this.deps.services, input.serviceIds);

    const { notBefore, notAfter } = bookingWindow(this.deps.now());
    if (input.start < notBefore || input.start > notAfter) {
      throw new BookingWindowError("La hora elegida está fuera del plazo de reserva.");
    }

    // Exigir que el inicio sea uno de los huecos libres cubre a la vez horario, alineación y solapes.
    const byBarber = await findFreeSlotsByBarber(
      this.deps,
      input.barberId,
      shopDateOf(input.start),
      totalDuration(services),
    );
    const candidates = byBarber
      .filter((b) => b.slots.some((slot) => slot.start.getTime() === input.start.getTime()))
      .sort((a, b) => b.slots.length - a.slots.length);
    if (candidates.length === 0) throw new SlotUnavailableError();

    const products = await this.loadProductLines(input.products ?? []);
    const customer = await this.findOrCreateCustomer(input.customer);
    const lines = services.map((s) => ({
      serviceId: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
    }));

    for (const { barberId } of candidates) {
      const appointment = Appointment.book({
        id: crypto.randomUUID(),
        barberId,
        customerId: customer.id,
        start: input.start,
        services: lines,
        products,
      });
      try {
        await this.deps.appointments.save(appointment);
        return appointment;
      } catch (error) {
        // Otra reserva ganó ese hueco justo ahora: sin preferencia, aún puede atenderle otro barbero.
        if (!(error instanceof SlotUnavailableError)) throw error;
      }
    }
    throw new SlotUnavailableError();
  }

  private async loadProductLines(items: readonly { productId: string; quantity: number }[]): Promise<ProductLine[]> {
    if (items.length === 0) return [];
    const found = await this.deps.products.findByIds(items.map((i) => i.productId));
    return items.map(({ productId, quantity }) => {
      const product = found.find((p) => p.id === productId);
      if (!product?.active) throw new NotFoundError("Producto", productId);
      return { productId, name: product.name, quantity, unitPriceCents: product.priceCents };
    });
  }

  private async findOrCreateCustomer(input: { name: string; phone: string }): Promise<Customer> {
    const phone = normalizePhone(input.phone);
    const existing = await this.deps.customers.findByPhone(phone);
    if (existing) return existing;
    return this.deps.customers.save({ id: crypto.randomUUID(), name: input.name.trim(), phone });
  }
}
