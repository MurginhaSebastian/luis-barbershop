import { eq, inArray, sql } from "drizzle-orm";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";
import type { Customer } from "@/core/entities/customer";
import type { Db } from "../client";
import { customers } from "../schema";

export class DrizzleCustomerRepository implements ICustomerRepository {
  constructor(private readonly db: Db) {}

  async findByIds(ids: readonly string[]): Promise<Customer[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(customers).where(inArray(customers.id, [...ids]));
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const [row] = await this.db.select().from(customers).where(eq(customers.phone, phone));
    return row ?? null;
  }

  async save(customer: Customer): Promise<Customer> {
    // Update sin cambios para que RETURNING devuelva la fila existente si el teléfono ya estaba.
    const [row] = await this.db
      .insert(customers)
      .values(customer)
      .onConflictDoUpdate({ target: customers.phone, set: { phone: sql`excluded.phone` } })
      .returning();
    return row;
  }
}
