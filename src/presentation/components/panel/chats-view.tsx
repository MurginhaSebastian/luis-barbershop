"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ChatThread } from "@/application/use-cases/chats/get-chats";
import { formatLongDate, formatTime } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { STATUS } from "./appointment-status";

const label = (t: ChatThread) => t.name ?? `+${t.phone}`;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-on-light";
const CARD = "rounded-lg border border-light-outline bg-light-card text-on-light-card";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
const awaitingReply = (t: ChatThread) => t.messages.at(-1)?.role === "user";

/** "Hoy 18:30", "Mañana 09:00" o "jueves 26 de noviembre 18:30", en hora de Lima. */
function whenLabel(iso: string, now: Date) {
  const start = new Date(iso);
  const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
  const day = dayKey(start) === dayKey(now) ? "Hoy" : dayKey(start) === dayKey(tomorrow) ? "Mañana" : formatLongDate(start);
  return `${day} ${formatTime(start)}`;
}

/**
 * Solo lectura: lo que el asistente de IA habló en las últimas 24 h. La selección va en la URL (`?c=`); el
 * buscador y el filtro viven aquí. Responder es desde WhatsApp: los atajos solo abren `wa.me` con el texto escrito.
 */
export function ChatsView({
  threads,
  selected,
  aiEnabled,
  address,
  mapsUrl,
}: {
  threads: ChatThread[];
  selected: ChatThread | null;
  aiEnabled: boolean;
  address?: string;
  mapsUrl?: string;
}) {
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [now] = useState(() => new Date());
  const q = query.trim().toLowerCase();
  const shown = threads.filter(
    (t) => (!onlyPending || awaitingReply(t)) && (!q || label(t).toLowerCase().includes(q) || t.phone.includes(q.replace(/^\+/, ""))),
  );
  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-4xl sm:text-5xl">Chats WhatsApp</h1>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            aiEnabled
              ? "border-status-confirmed-border bg-status-confirmed-bg text-status-confirmed-text"
              : "border-status-done-border bg-status-done-bg text-status-done-text",
          )}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {aiEnabled ? "Asistente activo" : "Asistente apagado"}
        </span>
        <div role="group" aria-label="Filtrar chats" className="ml-auto inline-flex overflow-hidden rounded-md border border-light-outline bg-light-card text-sm">
          {(
            [
              ["Todos", false],
              ["Por responder", true],
            ] as const
          ).map(([text, value]) => (
            <button
              key={text}
              type="button"
              aria-pressed={onlyPending === value}
              onClick={() => setOnlyPending(value)}
              className={cn(
                "px-3 py-1.5 transition-colors duration-150 motion-reduce:transition-none",
                FOCUS,
                onlyPending === value ? "bg-on-light-card font-semibold text-light-card" : "text-on-light-card hover:bg-status-done-bg",
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {threads.length === 0 ? (
        <p className="mt-6 text-light-muted">No hay conversaciones en las últimas 24 horas.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
          <nav aria-label="Conversaciones" className={cn("min-w-0", selected && "hidden lg:block")}>
            <div className={cn(CARD, "p-3")}>
              <label className="flex items-center gap-2 rounded-md border border-light-outline bg-light-canvas px-3 py-2 focus-within:outline-2 focus-within:outline-gold-on-light">
                <Search aria-hidden className="size-4 shrink-0 text-light-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente o número…"
                  aria-label="Buscar cliente o número"
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-light-muted"
                />
              </label>
            </div>
            {shown.length === 0 ? (
              <p className="mt-3 text-sm text-light-muted">Ninguna conversación coincide.</p>
            ) : (
              <ul className={cn(CARD, "mt-3 divide-y divide-light-outline overflow-hidden")}>
                {shown.map((t) => (
                  <li key={t.phone}>
                    <ThreadLink thread={t} active={t.phone === selected?.phone} />
                  </li>
                ))}
              </ul>
            )}
          </nav>
          <section aria-label="Conversación" className={cn("min-w-0", !selected && "hidden lg:block")}>
            {selected ? (
              <Thread thread={selected} now={now} address={address} mapsUrl={mapsUrl} />
            ) : (
              <p className="text-light-muted">Elige una conversación.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ThreadLink({ thread: t, active }: { thread: ChatThread; active: boolean }) {
  const next = t.nextAppointment;
  return (
    <Link
      href={`/panel/chats?c=${t.phone}`}
      aria-current={active ? "true" : undefined}
      className={cn("block border-l-2 px-4 py-3", FOCUS, active ? "border-gold-on-light bg-gold/15" : "border-transparent hover:bg-light-canvas")}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium">{label(t)}</span>
        <time dateTime={t.lastAt} className="shrink-0 text-xs text-light-muted">
          {formatTime(t.lastAt)}
        </time>
      </span>
      <span className="mt-0.5 block truncate text-sm text-light-muted">{t.preview}</span>
      {next && (
        <span className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 font-medium", STATUS[next.status].badge)}>{STATUS[next.status].short}</span>
          <span className="truncate text-light-muted">
            {next.services[0]} · {formatTime(next.startsAt)}
          </span>
        </span>
      )}
    </Link>
  );
}

function Thread({ thread, now, address, mapsUrl }: { thread: ChatThread; now: Date; address?: string; mapsUrl?: string }) {
  const next = thread.nextAppointment;
  const wa = (text?: string) => `https://wa.me/${thread.phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  const shortcuts: { name: string; text: string }[] = [
    ...(next ? [{ name: `Te esperamos ${formatTime(next.startsAt)}`, text: `Te esperamos a las ${formatTime(next.startsAt)}.` }] : []),
    ...(address ? [{ name: "Enviar ubicación", text: mapsUrl ? `${address}\n${mapsUrl}` : address }] : []),
    { name: "Reprogramar cita", text: "¿Para qué día y hora te gustaría reprogramar tu cita?" },
  ];
  const link = cn("rounded-md border border-light-outline bg-light-canvas px-3 py-1.5 text-sm font-medium hover:bg-status-done-bg", FOCUS);
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <Link href="/panel/chats" className={cn("inline-block px-4 pt-3 text-sm text-gold-on-light underline underline-offset-4 lg:hidden", FOCUS)}>
        ‹ Todos los chats
      </Link>
      <header className="border-b border-light-outline px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-heading text-2xl">{label(thread)}</h2>
          {next && (
            <span className="rounded-md border border-light-outline bg-light-canvas px-2 py-0.5 text-xs">
              {whenLabel(next.startsAt, now)} · {next.services.join(" + ")}
              {next.barberName && ` · ${next.barberName}`}
            </span>
          )}
        </div>
        <p className="text-sm text-light-muted">+{thread.phone}</p>
      </header>
      <ol className="flex flex-col gap-2 bg-light-canvas p-4">
        {thread.messages.map((m, i) => (
          <li
            key={i}
            className={cn("max-w-[85%] rounded-lg px-3 py-2", m.role === "user" ? "self-start border border-light-outline bg-light-card" : "self-end bg-on-light-card text-light-card")}
          >
            <span className="sr-only">{m.role === "user" ? "Cliente: " : "Asistente: "}</span>
            {/* Texto plano: lo escribe un tercero, nunca se interpreta. */}
            <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
            <time dateTime={m.at} className={cn("mt-1 block text-right text-[11px]", m.role === "user" ? "text-light-muted" : "text-dark-muted")}>
              {formatTime(m.at)} · {m.role === "user" ? label(thread) : "Asistente"}
            </time>
          </li>
        ))}
      </ol>
      <footer className="flex flex-wrap items-center gap-2 border-t border-light-outline px-4 py-3">
        {shortcuts.map((s) => (
          <a key={s.name} href={wa(s.text)} target="_blank" rel="noopener noreferrer" className={link}>
            {s.name}
          </a>
        ))}
        <a href={wa()} target="_blank" rel="noopener noreferrer" className={cn("ml-auto rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-on-gold", FOCUS)}>
          Escribirle por WhatsApp
        </a>
      </footer>
    </div>
  );
}
