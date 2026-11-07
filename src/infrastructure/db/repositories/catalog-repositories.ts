import { eq, inArray } from "drizzle-orm";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { IProductRepository } from "@/application/ports/repositories/product-repository";
import type { IServiceRepository } from "@/application/ports/repositories/service-repository";
import type { Barber, Product, Service } from "@/core/entities/catalog";
import type { Db } from "../client";
import { barbers, products, services } from "../schema";

export class DrizzleServiceRepository implements IServiceRepository {
  constructor(private readonly db: Db) {}

  async findByIds(ids: readonly string[]): Promise<Service[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(services).where(inArray(services.id, [...ids]));
  }

  async findAllActive(): Promise<Service[]> {
    return this.db.select().from(services).where(eq(services.active, true)).orderBy(services.name);
  }

  async findAll(): Promise<Service[]> {
    return this.db.select().from(services).orderBy(services.name);
  }

  async save(service: Service): Promise<void> {
    await this.db.insert(services).values(service).onConflictDoUpdate({ target: services.id, set: service });
  }
}

export class DrizzleProductRepository implements IProductRepository {
  constructor(private readonly db: Db) {}

  async findByIds(ids: readonly string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(products).where(inArray(products.id, [...ids]));
  }

  async findAllActive(): Promise<Product[]> {
    return this.db.select().from(products).where(eq(products.active, true)).orderBy(products.name);
  }

  async findAll(): Promise<Product[]> {
    return this.db.select().from(products).orderBy(products.name);
  }

  async save(product: Product): Promise<void> {
    await this.db.insert(products).values(product).onConflictDoUpdate({ target: products.id, set: product });
  }
}

export class DrizzleBarberRepository implements IBarberRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Barber | null> {
    const [row] = await this.db.select().from(barbers).where(eq(barbers.id, id));
    return row ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Barber[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(barbers).where(inArray(barbers.id, [...ids]));
  }

  async findAllActive(): Promise<Barber[]> {
    return this.db.select().from(barbers).where(eq(barbers.active, true)).orderBy(barbers.name);
  }

  async findAll(): Promise<Barber[]> {
    return this.db.select().from(barbers).orderBy(barbers.name);
  }

  async save(barber: Barber): Promise<void> {
    await this.db.insert(barbers).values(barber).onConflictDoUpdate({ target: barbers.id, set: barber });
  }
}
