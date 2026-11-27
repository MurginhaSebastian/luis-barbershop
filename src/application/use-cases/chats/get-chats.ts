import type { IConversationRepository } from "@/application/ports/repositories/conversation-repository";
import { AppointmentStatus } from "@/core/entities/appointment";
import type { IAppointmentRepository } from "@/application/ports/repositories/appointment-repository";
import type { IBarberRepository } from "@/application/ports/repositories/barber-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";

const WINDOW_MS = 24 * 60 * 60_000;
const UPCOMING = new Set<AppointmentStatus>([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.AT_RISK]);

export interface NextAppointment {
  status: AppointmentStatus;
  /** ISO del inicio. */
  startsAt: string;
  services: string[];
  barberName: string;
}

export interface ChatThread {
  phone: string;
  /** El nombre del cliente si ya reservó alguna vez; si no, null. */
  name: string | null;
  /** ISO del último mensaje. */
  lastAt: string;
  preview: string;
  /** La próxima cita sin atender del cliente, o null. */
  nextAppointment: NextAppointment | null;
  messages: { role: "user" | "assistant"; content: string; at: string }[];
}

/** Las conversaciones del asistente de IA de las últimas 24 h, la más reciente primero. Solo lectura. */
export class GetChatsUseCase {
  constructor(
    private readonly deps: {
      conversations: IConversationRepository;
      customers: ICustomerRepository;
      appointments: IAppointmentRepository;
      barbers: IBarberRepository;
      now: () => Date;
    },
  ) {}

  async execute(): Promise<ChatThread[]> {
    const { conversations, customers, appointments, barbers, now } = this.deps;
    const turns = await conversations.since(new Date(now().getTime() - WINDOW_MS));
    const byPhone = new Map<string, ChatThread["messages"]>();
    for (const t of turns) {
      const list = byPhone.get(t.phone) ?? [];
      list.push({ role: t.role, content: t.content, at: t.at.toISOString() });
      byPhone.set(t.phone, list);
    }
    // El teléfono guardado ya está normalizado (normalizePhone), igual que el de los clientes.
    const threads = await Promise.all(
      [...byPhone].map(async ([phone, messages]): Promise<ChatThread> => {
        const last = messages.at(-1)!;
        const customer = await customers.findByPhone(phone);
        const next = customer
          ? (await appointments.findByCustomerFrom(customer.id, now()))
              .filter((a) => UPCOMING.has(a.status))
              .sort((a, b) => a.slot.start.getTime() - b.slot.start.getTime())[0]
          : undefined;
        const nextAppointment = next
          ? {
              status: next.status,
              startsAt: next.slot.start.toISOString(),
              services: next.services.map((l) => l.name),
              barberName: (await barbers.findById(next.barberId))?.name ?? "",
            }
          : null;
        return { phone, name: customer?.name ?? null, lastAt: last.at, preview: last.content, nextAppointment, messages };
      }),
    );
    return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }
}
