"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { Agenda, AgendaItem } from "@/application/use-cases/agenda/get-agenda";
import type { AppointmentStatus } from "@/core/entities/appointment";
import { shopDateOf } from "@/core/scheduling/availability";
import { shiftPeriod, weeks } from "@/presentation/lib/days";
import { formatDayParts, formatLongDate, formatTime } from "@/presentation/lib/format";
import { CAL_PX_PER_MINUTE, gridHours, isOperational, limaMinuteOfDay, placeDay, type Interval } from "@/presentation/lib/timeline";
import { cn } from "@/presentation/lib/utils";
import { STATUS, type ChangeStatusAction } from "./agenda-card";
import { AppointmentDialog } from "./appointment-dialog";
import { PendingDialog } from "./pending-dialog";

type View = Agenda["view"];

const GREY = "bg-cal-done-text";
const DONE = "border-l-[3px] border-cal-done-line bg-cal-done-bg text-cal-done-text";
// Una sola gama dorada: lo firme es más intenso; lo pendiente, más tenue; lo que corre riesgo, punteado.
const LOOK: Record<AppointmentStatus, { cls: string; dot: string }> = {
  CONFIRMED: { cls: "border-l-[3px] border-cal-accent bg-cal-accent/22 text-cal-text", dot: "bg-cal-accent" },
  PENDING: { cls: "border-l-[3px] border-cal-accent/45 bg-cal-accent/9 text-cal-pending-text", dot: "bg-cal-accent/45" },
  AT_RISK: {
    cls: "border border-dashed border-cal-accent bg-cal-accent/5 text-cal-accent shadow-[inset_3px_0_0_var(--cal-accent)]",
    dot: "border border-cal-accent",
  },
  COMPLETED: { cls: DONE, dot: GREY },
  NO_SHOW: { cls: DONE, dot: GREY },
  CANCELLED: { cls: DONE, dot: GREY },
  EXPIRED: { cls: DONE, dot: GREY },
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTH_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const VIEWS: { view: View; label: string }[] = [
  { view: "dia", label: "Día" },
  { view: "semana", label: "Semana" },
  { view: "mes", label: "Mes" },
];
const PERIOD = {
  dia: ["Día anterior", "Día siguiente"],
  semana: ["Semana anterior", "Semana siguiente"],
  mes: ["Mes anterior", "Mes siguiente"],
} as const;

const href = (view: View, date?: string) => `/panel?vista=${view}${date ? `&dia=${date}` : ""}`;
const pill =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-cal-line px-3 text-sm transition-colors duration-200 hover:border-cal-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cal-accent";

function title(view: View, date: string, today: string, days: readonly string[]): string {
  if (view === "dia") return date === today ? "Hoy" : formatLongDate(`${date}T12:00:00-05:00`);
  const month = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];
  if (view === "mes") return `${month(date)[0].toUpperCase()}${month(date).slice(1)} de ${date.slice(0, 4)}`;
  const [first, last] = [days[0], days[days.length - 1]];
  const [d1, d2] = [Number(first.slice(8)), Number(last.slice(8))];
  return first.slice(5, 7) === last.slice(5, 7)
    ? `${d1} – ${d2} de ${month(last)} de ${last.slice(0, 4)}`
    : `${d1} de ${month(first)} – ${d2} de ${month(last)} de ${last.slice(0, 4)}`;
}

/** Tramo de un instante recortado a un día de Lima, en minutos (0–1440); null si no lo toca. */
function dayMinutes(date: string, iv: Interval): [number, number] | null {
  const midnight = Date.parse(`${date}T00:00:00-05:00`);
  const [s, e] = [Math.max(0, (Date.parse(iv.start) - midnight) / 60_000), Math.min(1440, (Date.parse(iv.end) - midnight) / 60_000)];
  return e > s ? [s, e] : null;
}

function EventButton(props: { item: AgendaItem; onOpen: (id: string) => void; label?: boolean; className?: string; style?: CSSProperties }) {
  const { item } = props;
  const time = formatTime(item.start);
  const { short } = STATUS[item.status];
  return (
    <button
      type="button"
      aria-label={`${time} ${item.customerName}, ${short}`}
      onClick={() => props.onOpen(item.id)}
      style={props.style}
      className={cn("flex min-h-6 min-w-0 cursor-pointer items-start gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs", focus, LOOK[item.status].cls, props.className)}
    >
      <span className="min-w-0 flex-1 truncate font-bold">
        <span className="tabular-nums">{time}</span> {item.customerName}
      </span>
      {props.label && (
        <span aria-hidden className="mt-px hidden shrink-0 text-[10px] sm:inline">
          {short}
        </span>
      )}
      <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", LOOK[item.status].dot)} />
    </button>
  );
}

const dayOf = (item: AgendaItem) => shopDateOf(new Date(item.start));

function TimeGrid(props: { agenda: Agenda; items: AgendaItem[]; barber: string | null; today: string; onOpen: (id: string) => void }) {
  const { agenda, items, today } = props;
  const [now, setNow] = useState<string>();
  useEffect(() => {
    // Tras montar, para que servidor y cliente pinten lo mismo al hidratar.
    const tick = () => setNow(new Date().toISOString());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // shortcut: los bloqueos no ensanchan la grilla (uno de todo el día la llevaría a 24 h); se recortan a ella.
  const grid = gridHours([...agenda.open, ...items]);
  const height = (grid.endMinute - grid.startMinute) * CAL_PX_PER_MINUTE;
  const hours = Array.from({ length: (grid.endMinute - grid.startMinute) / 60 + 1 }, (_, i) => grid.startMinute / 60 + i);
  const blocks = agenda.blocks.filter((b) => !props.barber || b.barberName === props.barber);
  const nowMinute = now ? limaMinuteOfDay(now) : -1;
  const px = (minute: number) => (minute - grid.startMinute) * CAL_PX_PER_MINUTE;
  const shade = (s: number, e: number, cls: string, key: string) => {
    const [from, to] = [Math.max(s, grid.startMinute), Math.min(e, grid.endMinute)];
    return to > from ? <div key={key} aria-hidden style={{ top: px(from), height: (to - from) * CAL_PX_PER_MINUTE }} className={cn("absolute inset-x-0", cls)} /> : null;
  };

  return (
    <div className="overflow-x-auto rounded-b-xl border border-t-0 border-cal-line bg-cal-canvas">
      <div className={cn("flex pb-3", agenda.days.length > 1 && "min-w-[640px]")}>
        <div className="w-12 shrink-0">
          <div className="h-14" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span
                key={h}
                aria-hidden
                style={{ top: px(h * 60) }}
                className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-cal-done-text first:translate-y-0"
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
        {agenda.days.map((d) => {
          const parts = formatDayParts(d);
          const isToday = d === today;
          const open = agenda.open
            .filter((o) => o.date === d)
            .map((o) => dayMinutes(d, o))
            .filter((m) => m !== null)
            .sort((a, b) => a[0] - b[0]);
          // Lo que queda fuera de los tramos abiertos de ese día está cerrado.
          const closed: [number, number][] = [];
          let cursor = grid.startMinute;
          for (const [s, e] of open) {
            if (s > cursor) closed.push([cursor, s]);
            cursor = Math.max(cursor, e);
          }
          if (cursor < grid.endMinute) closed.push([cursor, grid.endMinute]);
          return (
            <div key={d} className="min-w-0 flex-1 border-l border-cal-line">
              <div className="flex h-14 flex-col items-center justify-center text-xs text-cal-done-text">
                <span className="capitalize">{parts.weekday}</span>
                <span className={cn("flex size-7 items-center justify-center rounded-full text-sm", isToday && "bg-cal-accent font-semibold text-cal-canvas")}>
                  {parts.day}
                </span>
              </div>
              <div
                className="relative"
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--cal-line) 0 1px, transparent 1px ${60 * CAL_PX_PER_MINUTE}px)`,
                }}
              >
                {closed.map(([s, e], i) => shade(s, e, "bg-cal-line/40", `c${i}`))}
                {blocks.map((b, i) => {
                  const m = dayMinutes(d, b);
                  return m && shade(m[0], m[1], "bg-cal-line/80", `b${i}`);
                })}
                {placeDay(items.filter((i) => dayOf(i) === d), grid).map(({ item, top, height: h, lane, lanes }) => (
                  <EventButton
                    key={item.id}
                    item={item}
                    onOpen={props.onOpen}
                    label={agenda.view === "dia"}
                    style={{ top, height: h, left: `calc(${(lane / lanes) * 100}% + 1px)`, width: `calc(${100 / lanes}% - 2px)` }}
                    className="absolute"
                  />
                ))}
                {isToday && nowMinute >= grid.startMinute && nowMinute <= grid.endMinute && (
                  <div aria-hidden style={{ top: px(nowMinute) }} className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-cal-accent">
                    <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-cal-accent" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid(props: { agenda: Agenda; items: AgendaItem[]; date: string; today: string; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-b-xl border border-t-0 border-cal-line bg-cal-canvas">
      <div className="grid grid-cols-7 border-b border-cal-line text-center text-[11px] text-cal-done-text">
        {MONTH_HEADERS.map((h) => (
          <span key={h} className="py-1">
            {h}
          </span>
        ))}
      </div>
      {weeks(props.agenda.days).map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-cal-line last:border-b-0">
          {week.map((d) => {
            const day = props.items.filter((i) => dayOf(i) === d);
            return (
              <div key={d} className="min-h-20 min-w-0 space-y-0.5 overflow-hidden border-l border-cal-line p-0.5 first:border-l-0">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    d === props.today ? "bg-cal-accent font-semibold text-cal-canvas" : d.slice(0, 7) === props.date.slice(0, 7) ? "text-cal-text" : "text-cal-done-text",
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {day.slice(0, 3).map((item) => (
                  <EventButton key={item.id} item={item} onOpen={props.onOpen} className="w-full" />
                ))}
                {day.length > 3 && (
                  <Link href={href("dia", d)} className={cn("block rounded px-1 text-[11px] text-cal-accent underline", focus)}>
                    +{day.length - 3} más
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Calendario Día/Semana/Mes: barra superior, grilla (o mes) y ficha de la cita al tocarla. */
export function AgendaCalendar(props: { agenda: Agenda; date: string; today: string; changeStatus: ChangeStatusAction }) {
  const { agenda, date, today } = props;
  const { view } = agenda;
  const [selected, setSelected] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const barbers = [...new Set(agenda.items.map((i) => i.barberName))];
  // Al cambiar de periodo, un barbero sin citas vuelve a "Todos".
  const barber = chosen && barbers.includes(chosen) ? chosen : null;
  const shown = agenda.items.filter((i) => !barber || i.barberName === barber);
  const operational = shown.filter((i) => isOperational(i.status));
  const closed = shown.filter((i) => !isOperational(i.status));
  const [before, after] = PERIOD[view];

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-t-xl border border-cal-line bg-cal-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="agenda-dia" className="font-heading text-2xl first-letter:uppercase sm:text-3xl">
            {title(view, date, today, agenda.days)}
          </h2>
          <nav aria-label="Cambiar de día" className="flex items-center gap-2">
            <Link href={href(view, shiftPeriod(view, date, -1))} aria-label={before} className={pill}>
              <ChevronLeft aria-hidden className="size-4" />
            </Link>
            {!agenda.days.includes(today) && (
              <Link href={href(view)} className={pill}>
                Hoy
              </Link>
            )}
            <Link href={href(view, shiftPeriod(view, date, 1))} aria-label={after} className={pill}>
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </nav>
        </div>
        <nav aria-label="Vista" className="flex rounded-full border border-cal-line p-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.view}
              href={href(v.view, date)}
              aria-current={v.view === view ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm", focus, v.view === view ? "bg-cal-accent font-semibold text-cal-canvas" : "hover:text-cal-accent")}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {barbers.length > 1 && (
            <div role="group" aria-label="Ver la agenda de" className="flex flex-wrap gap-2">
              {[null, ...barbers].map((name) => (
                <button
                  key={name ?? ""}
                  type="button"
                  aria-pressed={barber === name}
                  onClick={() => setChosen(name)}
                  className={cn(pill, "aria-pressed:border-cal-accent aria-pressed:bg-cal-accent aria-pressed:font-semibold aria-pressed:text-cal-canvas")}
                >
                  {name ?? "Todos"}
                </button>
              ))}
            </div>
          )}
          {agenda.pending.length > 0 && (
            <button type="button" onClick={() => setListOpen(true)} className={cn(pill, "border-cal-accent/60 text-cal-pending-text")}>
              Por confirmar: {agenda.pending.length}
            </button>
          )}
          <Link href="/reservar" className={cn(pill, "border-cal-accent text-cal-accent")}>
            + Nueva cita
          </Link>
        </div>
      </div>

      {view === "mes" ? (
        <MonthGrid agenda={agenda} items={operational} date={date} today={today} onOpen={setSelected} />
      ) : (
        <TimeGrid agenda={agenda} items={operational} barber={barber} today={today} onOpen={setSelected} />
      )}

      {view === "dia" && agenda.items.length === 0 && <p className="mt-4 text-muted-foreground">No hay citas este día.</p>}
      {view === "dia" && closed.length > 0 && (
        <>
          <h3 className="mt-8 font-heading text-2xl">Canceladas y vencidas</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {closed.map((item) => (
              <li key={item.id}>
                <EventButton item={item} onOpen={setSelected} label className="min-h-8 items-center" />
              </li>
            ))}
          </ul>
        </>
      )}

      <PendingDialog
        open={listOpen}
        items={agenda.pending}
        onClose={() => setListOpen(false)}
        onPick={(id) => {
          setListOpen(false);
          setSelected(id);
        }}
      />
      {/* Una cita por confirmar puede caer fuera del rango visible. */}
      <AppointmentDialog item={agenda.items.find((i) => i.id === selected) ?? agenda.pending.find((i) => i.id === selected)} onClose={() => setSelected(null)} changeStatus={props.changeStatus} />
    </>
  );
}
