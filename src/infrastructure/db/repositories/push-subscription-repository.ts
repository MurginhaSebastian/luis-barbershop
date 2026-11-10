import { eq } from "drizzle-orm";
import type { IPushSubscriptionRepository } from "@/application/ports/push";
import type { PushSubscription } from "@/core/entities/push";
import type { Db } from "../client";
import { pushSubscriptions } from "../schema";

export class DrizzlePushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(private readonly db: Db) {}

  findAll(): Promise<PushSubscription[]> {
    return this.db
      .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions);
  }

  async save(subscription: PushSubscription): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: subscription.p256dh, auth: subscription.auth } });
  }

  async remove(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
