import type { IncomingMessage } from "@/application/ports/assistant";

const MAX_CHARS = 250;

interface Batch {
  messages: IncomingMessage[];
  debounce: ReturnType<typeof setTimeout>;
  deadline: ReturnType<typeof setTimeout>;
  waiters: { resolve: () => void; reject: (error: unknown) => void }[];
}

/**
 * Junta los textos que un mismo celular manda seguidos y los entrega como uno solo, para gastar una llamada al
 * modelo en vez de varias. Espera `delayMs` desde el último mensaje, pero vacía al llegar a `maxMessages` o a
 * `maxWaitMs` desde el primero.
 * shortcut: el búfer vive en la memoria del proceso; con varias instancias (o un recargue en dev) los mensajes
 * de un celular pueden caer en lotes distintos. Pasar a una cola compartida si la web escala.
 */
export class MessageBatcher {
  private readonly batches = new Map<string, Batch>();

  constructor(
    private readonly options: {
      delayMs: number;
      maxWaitMs?: number;
      maxMessages?: number;
      flush: (message: IncomingMessage) => Promise<unknown>;
    },
  ) {}

  /** Se resuelve cuando el lote al que pertenece el mensaje terminó de atenderse; se rechaza si falla. */
  add(message: IncomingMessage): Promise<void> {
    const { delayMs, maxWaitMs = 10_000, maxMessages = 5 } = this.options;
    return new Promise<void>((resolve, reject) => {
      let batch = this.batches.get(message.from);
      if (batch) clearTimeout(batch.debounce);
      else {
        batch = { messages: [], waiters: [], debounce: undefined as never, deadline: setTimeout(() => void this.flush(message.from), maxWaitMs) };
        this.batches.set(message.from, batch);
      }
      batch.messages.push(message);
      batch.waiters.push({ resolve, reject });
      if (batch.messages.length >= maxMessages) void this.flush(message.from);
      else batch.debounce = setTimeout(() => void this.flush(message.from), delayMs);
    });
  }

  private async flush(from: string): Promise<void> {
    const batch = this.batches.get(from);
    if (!batch) return;
    this.batches.delete(from);
    clearTimeout(batch.debounce);
    clearTimeout(batch.deadline);
    // Cada texto se recorta y, si el conjunto no cabe, se conserva el final: la petición suele venir al último.
    const text = batch.messages.map((m) => m.text.slice(0, MAX_CHARS)).join("\n").slice(-MAX_CHARS);
    try {
      await this.options.flush({ id: batch.messages.at(-1)!.id, from, text });
      for (const w of batch.waiters) w.resolve();
    } catch (error) {
      for (const w of batch.waiters) w.reject(error);
    }
  }
}
