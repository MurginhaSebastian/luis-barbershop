import { Appointment, type ProductLine, totalDuration } from "@/core/entities/appointment";
import { type Customer, normalizePhone } from "@/core/entities/customer";
import { BookingWindowError, NotFoundError, SlotUnavailableError } from "@/core/errors/domain-errors";
import { bookingWindow, shopDateOf } from "@/core/scheduling/availability";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { IProductRepository } from "@/application/ports/repositories/product-repository";
import { type AvailabilityDeps, findFreeSlots, loadBookableServices } from "./availability";

export interface CreateAppointmentInput {
  barberId: string;
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
    const free = await findFreeSlots(this.deps, input.barberId, shopDateOf(input.start), totalDuration(services));
    if (!free.some((slot) => slot.start.getTime() === input.start.getTime())) {
      throw new SlotUnavailableError();
    }

    const products = await this.loadProductLines(input.products ?? []);
    const customer = await this.findOrCreateCustomer(input.customer);

    const appointment = Appointment.book({
      id: crypto.randomUUID(),
      barberId: input.barberId,
      customerId: customer.id,
      start: input.start,
      services: services.map((s) => ({
        serviceId: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      })),
      products,
    });
    await this.deps.appointments.save(appointment);
    return appointment;
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
    const customer = { id: crypto.randomUUID(), name: input.name.trim(), phone };
    await this.deps.customers.save(customer);
    return customer;
  }
}
