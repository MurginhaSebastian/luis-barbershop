import type { Customer } from "@/core/entities/customer";

export interface ICustomerRepository {
  /** Recibe el teléfono ya normalizado con normalizePhone. */
  findByPhone(phone: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
