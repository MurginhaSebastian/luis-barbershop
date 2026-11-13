import { eq } from "drizzle-orm";
import type { IProcessedMessageRepository } from "@/application/ports/repositories/processed-message-repository";
import type { Db } from "../client";
import { processedMessages } from "../schema";

export class DrizzleProcessedMessageRepository implements IProcessedMessageRepository {
  constructor(private readonly db: Db) {}

  async wasProcessed(messageId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: processedMessages.messageId })
      .from(processedMessages)
      .where(eq(processedMessages.messageId, messageId));
    return !!row;
  }

  async markProcessed(messageId: string): Promise<void> {
    await this.db.insert(processedMessages).values({ messageId }).onConflictDoNothing();
  }
}
