import type { Barber, Product, Service } from "@/core/entities/catalog";
import type { BusinessHours } from "@/core/scheduling/availability";
import { type OpeningStatus, openingStatus } from "@/core/scheduling/opening-status";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IProductRepository } from "@/application/ports/repositories/product-repository";
import type { IScheduleRepository } from "@/application/ports/repositories/schedule-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";

export interface Catalog {
  services: Service[];
  barbers: Barber[];
  products: Product[];
  /** Índice 0 = domingo … 6 = sábado; lista vacía = cerrado. */
  weeklyHours: BusinessHours[][];
}

export interface GetCatalogDeps {
  services: IServiceRepository;
  barbers: IBarberRepository;
  products: IProductRepository;
  schedule: IScheduleRepository;
  now: () => Date;
}

export class GetCatalogUseCase {
  constructor(private readonly deps: GetCatalogDeps) {}

  async execute(): Promise<Catalog> {
    const [services, barbers, products, weeklyHours] = await Promise.all([
      this.deps.services.findAllActive(),
      this.deps.barbers.findAllActive(),
      this.deps.products.findAllActive(),
      Promise.all([0, 1, 2, 3, 4, 5, 6].map((weekday) => this.deps.schedule.findBusinessHours(weekday))),
    ]);
    return { services, barbers, products, weeklyHours };
  }

  /** Abierta ahora o cuándo abre, con los cierres de toda la barbería descontados. */
  async openingStatus(): Promise<OpeningStatus | null> {
    const now = this.deps.now();
    const [weeklyHours, blocks] = await Promise.all([
      Promise.all([0, 1, 2, 3, 4, 5, 6].map((weekday) => this.deps.schedule.findBusinessHours(weekday))),
      this.deps.schedule.findBlocksFrom(now),
    ]);
    const closures = blocks.filter((b) => b.barberId === null).map((b) => b.slot);
    return openingStatus(weeklyHours, closures, now);
  }
}
