import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import type { ConversationTurn, IConversationRepository } from "@/application/ports/repositories/conversation-repository";
import type { Db } from "../client";
import { assistantMessages } from "../schema";

export class DrizzleConversationRepository implements IConversationRepository {
  constructor(private readonly db: Db) {}

  async recent(phone: string, since: Date, limit: number): Promise<ConversationTurn[]> {
    const rows = await this.db
      .select({ role: assistantMessages.role, content: assistantMessages.content })
      .from(assistantMessages)
      .where(and(eq(assistantMessages.phone, phone), gte(assistantMessages.createdAt, since)))
      .orderBy(desc(assistantMessages.id))
      .limit(limit);
    return rows.reverse().map(({ role, content }) => ({ role: role === "assistant" ? "assistant" : "user", content }));
  }

  async countUserTurns(phone: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(assistantMessages)
      .where(and(eq(assistantMessages.phone, phone), eq(assistantMessages.role, "user"), gte(assistantMessages.createdAt, since)));
    return row.n;
  }

  async append(phone: string, turns: readonly ConversationTurn[], at: Date, forgetBefore: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(assistantMessages).values(turns.map((t) => ({ phone, role: t.role, content: t.content, createdAt: at })));
      await tx.delete(assistantMessages).where(lt(assistantMessages.createdAt, forgetBefore));
    });
  }
}
