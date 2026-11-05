import type { Barber } from "@/core/entities/catalog";

export interface IBarberRepository {
  findById(id: string): Promise<Barber | null>;
  /** También los inactivos: sus citas pasadas siguen en la agenda. */
  findByIds(ids: readonly string[]): Promise<Barber[]>;
  findAllActive(): Promise<Barber[]>;
}
