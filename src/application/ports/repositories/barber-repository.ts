import type { Barber } from "@/core/entities/catalog";

export interface IBarberRepository {
  findById(id: string): Promise<Barber | null>;
  findAllActive(): Promise<Barber[]>;
}
