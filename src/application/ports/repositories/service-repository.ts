import type { Service } from "@/core/entities/catalog";

export interface IServiceRepository {
  findByIds(ids: readonly string[]): Promise<Service[]>;
  findAllActive(): Promise<Service[]>;
}
