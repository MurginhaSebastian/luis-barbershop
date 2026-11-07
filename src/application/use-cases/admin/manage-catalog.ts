import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IProductRepository } from "@/application/ports/repositories/product-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";
import { assertValidBarber, assertValidProduct, assertValidService } from "@/core/catalog/rules";
import type { Barber, Product, Service } from "@/core/entities/catalog";
import { TimeSlot } from "@/core/entities/time-slot";
import { bookingWindow } from "@/core/scheduling/availability";

/** Sin id es un alta. No hay borrado: lo que tiene citas solo se oculta con `active: false`. */
type Input<T extends { id: string }> = Omit<T, "id"> & { id?: string };

export interface ManageCatalogDeps {
  services: IServiceRepository;
  products: IProductRepository;
  barbers: IBarberRepository;
  appointments: IAppointmentRepository;
  now: () => Date;
}

export class ManageCatalogUseCase {
  constructor(private readonly deps: ManageCatalogDeps) {}

  listServices = () => this.deps.services.findAll();
  listProducts = () => this.deps.products.findAll();
  listBarbers = () => this.deps.barbers.findAll();

  async saveService(input: Input<Service>): Promise<void> {
    assertValidService(input);
    await this.deps.services.save(withId(input));
  }

  async saveProduct(input: Input<Product>): Promise<void> {
    assertValidProduct(input);
    await this.deps.products.save(withId(input));
  }

  /** Devuelve cuántas citas futuras conserva un barbero al ocultarlo: no se cancelan solas. */
  async saveBarber(input: Input<Barber>): Promise<{ upcoming: number }> {
    assertValidBarber(input);
    const barber = withId(input);
    await this.deps.barbers.save(barber);
    if (barber.active) return { upcoming: 0 };

    const now = this.deps.now();
    const range = TimeSlot.create(now, bookingWindow(now).notAfter);
    const appointments = await this.deps.appointments.findByBarberInRange(barber.id, range);
    return { upcoming: appointments.filter((a) => a.blocksSchedule()).length };
  }
}

function withId<T extends { id: string; name: string }>(input: Input<T>): T {
  return { ...input, id: input.id ?? crypto.randomUUID(), name: input.name.trim() } as T;
}
