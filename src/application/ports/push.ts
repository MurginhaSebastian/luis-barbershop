import type { PushSubscription } from "@/core/entities/push";

export interface IPushSubscriptionRepository {
  findAll(): Promise<PushSubscription[]>;
  /** Si el endpoint ya existe, actualiza sus claves. */
  save(subscription: PushSubscription): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Página que abre el aviso al tocarlo. */
  url: string;
}

export interface IPushSender {
  /** "gone": el navegador ya no acepta avisos en esa suscripción y hay que olvidarla. */
  send(subscription: PushSubscription, message: PushMessage): Promise<"sent" | "gone">;
}
