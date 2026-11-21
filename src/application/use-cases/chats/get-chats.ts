import type { IConversationRepository } from "@/application/ports/repositories/conversation-repository";
import type { ICustomerRepository } from "@/application/ports/repositories/customer-repository";

const WINDOW_MS = 24 * 60 * 60_000;

export interface ChatThread {
  phone: string;
  /** El nombre del cliente si ya reservó alguna vez; si no, null. */
  name: string | null;
  /** ISO del último mensaje. */
  lastAt: string;
  preview: string;
  messages: { role: "user" | "assistant"; content: string; at: string }[];
}

/** Las conversaciones del asistente de IA de las últimas 24 h, la más reciente primero. Solo lectura. */
export class GetChatsUseCase {
  constructor(private readonly deps: { conversations: IConversationRepository; customers: ICustomerRepository; now: () => Date }) {}

  async execute(): Promise<ChatThread[]> {
    const { conversations, customers, now } = this.deps;
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
        return { phone, name: (await customers.findByPhone(phone))?.name ?? null, lastAt: last.at, preview: last.content, messages };
      }),
    );
    return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }
}
