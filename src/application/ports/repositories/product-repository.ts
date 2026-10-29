import type { Product } from "@/core/entities/catalog";

export interface IProductRepository {
  findByIds(ids: readonly string[]): Promise<Product[]>;
  findAllActive(): Promise<Product[]>;
}
