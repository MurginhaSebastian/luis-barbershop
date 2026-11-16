import { eq } from "drizzle-orm";
import type { IProcessedMessageRepository } from "@/application/ports/repositories/processed-message-repository";
import type { Db } from "../client";
import { processedMessages } from "../schema";

export class DrizzleProcessedMessageRepository implements IProcessedMessageRepository {
  constructor(private readonly db: Db) {}

  async claim(messageId: string): Promise<boolean> {
    // La clave primaria decide: de dos inserciones simultáneas solo una devuelve fila.
    const rows = await this.db
      .insert(processedMessages)
      .values({ messageId })
      .onConflictDoNothing()
      .returning({ id: processedMessages.messageId });
    return rows.length > 0;
  }

  async release(messageId: string): Promise<void> {
    await this.db.delete(processedMessages).where(eq(processedMessages.messageId, messageId));
  }
}
