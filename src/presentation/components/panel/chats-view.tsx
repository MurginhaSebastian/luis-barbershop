import Link from "next/link";
import type { ChatThread } from "@/application/use-cases/chats/get-chats";
import { formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";

const label = (t: ChatThread) => t.name ?? `+${t.phone}`;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cal-accent";

/** Solo lectura: lo que el asistente de IA habló en las últimas 24 h. La selección va en la URL (`?c=`), sin estado cliente. */
export function ChatsView({ threads, selected }: { threads: ChatThread[]; selected: ChatThread | null }) {
  if (threads.length === 0) {
    return <p className="mt-6 text-muted-foreground">No hay conversaciones en las últimas 24 horas.</p>;
  }
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
      <nav aria-label="Conversaciones" className={cn("min-w-0", selected && "hidden lg:block")}>
        <ul className="divide-y divide-cal-line overflow-hidden rounded-lg border border-cal-line bg-cal-surface">
          {threads.map((t) => {
            const active = t.phone === selected?.phone;
            return (
              <li key={t.phone}>
                <Link
                  href={`/panel/chats?c=${t.phone}`}
                  aria-current={active ? "true" : undefined}
                  className={cn("block px-4 py-3 text-cal-text", FOCUS, active ? "bg-cal-accent/14" : "hover:bg-cal-accent/8")}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{label(t)}</span>
                    <time dateTime={t.lastAt} className="shrink-0 text-xs text-cal-done-text">
                      {formatTime(t.lastAt)}
                    </time>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-cal-done-text">{t.preview}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <section aria-label="Conversación" className={cn("min-w-0", !selected && "hidden lg:block")}>
        {selected ? <Thread thread={selected} /> : <p className="text-muted-foreground">Elige una conversación.</p>}
      </section>
    </div>
  );
}

function Thread({ thread }: { thread: ChatThread }) {
  return (
    <div className="rounded-lg border border-cal-line bg-cal-canvas">
      <Link href="/panel/chats" className={cn("inline-block px-4 pt-3 text-sm text-cal-accent underline underline-offset-4 lg:hidden", FOCUS)}>
        ‹ Todos los chats
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-cal-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-cal-text">{label(thread)}</h2>
          {thread.name && <p className="text-sm text-cal-done-text">+{thread.phone}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cal-line bg-cal-surface px-2.5 py-0.5 text-xs text-cal-done-text">Solo lectura · Bot automático</span>
          <a
            href={`https://wa.me/${thread.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("text-sm text-cal-accent underline underline-offset-4", FOCUS)}
          >
            Escribirle por WhatsApp
          </a>
        </div>
      </header>
      <ol className="flex flex-col gap-2 p-4">
        {thread.messages.map((m, i) => (
          <li
            key={i}
            className={cn(
              "max-w-[85%] rounded-lg border px-3 py-2 text-cal-text",
              m.role === "user" ? "self-start border-cal-line bg-cal-surface" : "self-end border-cal-accent bg-cal-accent/14",
            )}
          >
            <span className="sr-only">{m.role === "user" ? "Cliente: " : "Asistente: "}</span>
            {/* Texto plano: lo escribe un tercero, nunca se interpreta. */}
            <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
            <time dateTime={m.at} className="mt-1 block text-right text-[11px] text-cal-done-text">
              {formatTime(m.at)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
