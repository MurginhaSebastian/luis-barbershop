import type { Customer } from "@/core/entities/customer";

export interface ICustomerRepository {
  /** Recibe el teléfono ya normalizado con normalizePhone. */
  findByPhone(phone: string): Promise<Customer | null>;
  /** Guarda un cliente nuevo; si su teléfono ya existe (p. ej. dos reservas a la vez), devuelve el existente sin tocarlo. */
  save(customer: Customer): Promise<Customer>;
}
