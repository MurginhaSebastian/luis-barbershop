import type { Product } from "@/core/entities/catalog";

export interface IProductRepository {
  findByIds(ids: readonly string[]): Promise<Product[]>;
  findAllActive(): Promise<Product[]>;
  /** También los ocultos, para el panel. */
  findAll(): Promise<Product[]>;
  save(product: Product): Promise<void>;
}
