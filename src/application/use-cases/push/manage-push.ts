import type { IPushSender, IPushSubscriptionRepository, PushMessage } from "@/application/ports/push";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { Appointment } from "@/core/entities/appointment";
import { assertValidSubscription, type PushSubscription } from "@/core/entities/push";
import { shopDateTime } from "@/application/shop-time";

export interface ManagePushDeps {
  pushSubscriptions: IPushSubscriptionRepository;
  barbers: IBarberRepository;
  /** null: faltan las claves VAPID y este servidor no puede enviar avisos. */
  pushSender: IPushSender | null;
}

export interface DeliveryReport {
  sent: number;
  removed: number;
  failed: number;
}

/** Avisos push al panel del barbero cuando entra una reserva. */
export class ManagePushUseCase {
  constructor(private readonly deps: ManagePushDeps) {}

  get enabled(): boolean {
    return this.deps.pushSender !== null;
  }

  async subscribe(subscription: PushSubscription): Promise<void> {
    assertValidSubscription(subscription);
    await this.deps.pushSubscriptions.save(subscription);
  }

  unsubscribe(endpoint: string): Promise<void> {
    return this.deps.pushSubscriptions.remove(endpoint);
  }

  sendTest(): Promise<DeliveryReport> {
    return this.broadcast({ title: "Avisos activados", body: "Así te avisaremos de cada reserva nueva.", url: "/panel" });
  }

  /** Sin el celular del cliente: el aviso pasa por los servidores de Google, Apple o Microsoft. */
  async notifyNewBooking(appointment: Appointment): Promise<DeliveryReport> {
    const [barber] = await this.deps.barbers.findByIds([appointment.barberId]);
    const services = appointment.services.map((s) => s.name).join(", ");
    return this.broadcast({
      title: "Nueva reserva",
      body: `${appointment.customerName} · ${shopDateTime(appointment.slot.start)} · ${barber?.name ?? "barbero"}\n${services}`,
      url: "/panel",
    });
  }

  /** El cliente confirmó por WhatsApp: Luis ya no tiene que escribirle. */
  async notifyConfirmed(appointment: Appointment): Promise<DeliveryReport> {
    const [barber] = await this.deps.barbers.findByIds([appointment.barberId]);
    return this.broadcast({
      title: "Cita confirmada",
      body: `${appointment.customerName} confirmó por WhatsApp · ${shopDateTime(appointment.slot.start)} · ${barber?.name ?? "barbero"}`,
      url: "/panel",
    });
  }

  private async broadcast(message: PushMessage): Promise<DeliveryReport> {
    const report: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
    const sender = this.deps.pushSender;
    if (!sender) return report;
    const subscriptions = await this.deps.pushSubscriptions.findAll();
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          if ((await sender.send(subscription, message)) === "sent") {
            report.sent++;
          } else {
            await this.deps.pushSubscriptions.remove(subscription.endpoint);
            report.removed++;
          }
        } catch {
          // Un dispositivo que falla no impide avisar a los demás.
          report.failed++;
        }
      }),
    );
    return report;
  }
}
