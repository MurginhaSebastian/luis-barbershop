import type { Service } from "@/core/entities/catalog";

export interface IServiceRepository {
  findByIds(ids: readonly string[]): Promise<Service[]>;
  findAllActive(): Promise<Service[]>;
  /** También los ocultos, para el panel. */
  findAll(): Promise<Service[]>;
  save(service: Service): Promise<void>;
}
