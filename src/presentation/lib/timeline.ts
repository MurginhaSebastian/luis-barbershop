import type { AppointmentStatus } from "@/core/entities/appointment";
import { SHOP_UTC_OFFSET_MINUTES } from "@/core/scheduling/booking-policy";

/** Escala de la agenda: 3 px por minuto (una cita de 45 min mide 135 px), nunca menos de 64 px. */
export const PX_PER_MINUTE = 3;
export const MIN_BLOCK_PX = 64;
/** Un hueco entre citas se muestra si caben al menos 15 min. */
const MIN_GAP_MINUTES = 15;
const MAX_GAP_PX = 180;

const OPERATIONAL: ReadonlySet<AppointmentStatus> = new Set(["PENDING", "CONFIRMED", "AT_RISK", "COMPLETED", "NO_SHOW"]);

/** Las que van en la línea de tiempo; canceladas y vencidas van aparte, para no confundir lo que está en pie. */
export const isOperational = (status: AppointmentStatus) => OPERATIONAL.has(status);

const minutesBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 60_000);

export interface Interval {
  start: string;
  end: string;
}

type Span = [number, number];

/** Lo que puede estar libre en el día: el horario de apertura menos los bloqueos. */
export function freeTime(open: readonly Interval[], blocks: readonly Interval[]): Span[] {
  let spans: Span[] = open.map((o) => [Date.parse(o.start), Date.parse(o.end)]);
  for (const block of blocks) {
    const [from, to] = [Date.parse(block.start), Date.parse(block.end)];
    spans = spans.flatMap(([s, e]): Span[] =>
      to <= s || from >= e ? [[s, e]] : [...(s < from ? [[s, from] as Span] : []), ...(to < e ? [[to, e] as Span] : [])],
    );
  }
  return spans;
}

export type TimelineRow<T> =
  | { kind: "slot"; start: string; end: string; items: T[] }
  | { kind: "gap"; start: string; end: string; minutes: number };

/**
 * Citas del día en franjas, por hora de inicio. Las que se cruzan (otro barbero a la misma hora, o una en riesgo y
 * la que tomó su hora) comparten franja y se apilan una bajo otra, nunca encima. Entre franjas, los huecos libres:
 * solo dentro de `free` (horario menos bloqueos), así nunca sale "Libre" con la barbería cerrada o bloqueada.
 */
export function dayTimeline<T extends { start: string; end: string }>(items: readonly T[], free: readonly Span[]): TimelineRow<T>[] {
  const rows: TimelineRow<T>[] = [];
  let slot: Extract<TimelineRow<T>, { kind: "slot" }> | null = null;
  for (const item of items.toSorted((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    if (slot && Date.parse(item.start) < Date.parse(slot.end)) {
      slot.items.push(item);
      if (Date.parse(item.end) > Date.parse(slot.end)) slot.end = item.end;
      continue;
    }
    if (slot) rows.push(...gaps(Date.parse(slot.end), Date.parse(item.start), free));
    slot = { kind: "slot", start: item.start, end: item.end, items: [item] };
    rows.push(slot);
  }
  return rows;
}

function gaps(from: number, to: number, free: readonly Span[]): TimelineRow<never>[] {
  return free
    .map(([s, e]): Span => [Math.max(s, from), Math.min(e, to)])
    .filter(([s, e]) => e - s >= MIN_GAP_MINUTES * 60_000)
    .map(([s, e]) => ({ kind: "gap", start: new Date(s).toISOString(), end: new Date(e).toISOString(), minutes: (e - s) / 60_000 }));
}

/** Alto de una cita según su duración, con el mínimo para que texto y botones no se corten. */
export const blockHeight = (start: string, end: string) => Math.max(MIN_BLOCK_PX, minutesBetween(start, end) * PX_PER_MINUTE);

/** Alto de un hueco libre: a la misma escala, pero sin que una tarde vacía ocupe la pantalla entera. */
export const gapHeight = (minutes: number) => Math.min(MAX_GAP_PX, minutes * PX_PER_MINUTE);

/** Escala de la grilla del calendario: 1 px por minuto (60 px por hora). */
export const CAL_PX_PER_MINUTE = 1;
/** Alto mínimo de una cita en la grilla: área táctil de 24 px (WCAG 2.5.8). */
export const CAL_MIN_BLOCK_PX = 24;

/** Minutos desde la medianoche de Lima de un instante ISO (0–1439). */
export function limaMinuteOfDay(iso: string): number {
  return (((Math.floor(Date.parse(iso) / 60_000) + SHOP_UTC_OFFSET_MINUTES) % 1440) + 1440) % 1440;
}

/** Horas que muestra la grilla (minutos de Lima): del primer inicio al último fin, a la hora en punto. Sin nada, 9:00–20:00. */
export function gridHours(spans: readonly { start: string; end: string }[]): { startMinute: number; endMinute: number } {
  if (spans.length === 0) return { startMinute: 540, endMinute: 1200 };
  const starts = spans.map((s) => limaMinuteOfDay(s.start));
  const ends = spans.map((s, i) => starts[i] + minutesBetween(s.start, s.end));
  return {
    startMinute: Math.floor(Math.min(...starts) / 60) * 60,
    endMinute: Math.min(1440, Math.ceil(Math.max(...ends) / 60) * 60),
  };
}

/** Posición vertical en la grilla de un tramo de un día: top y alto en px (alto mínimo CAL_MIN_BLOCK_PX). */
export function toGrid(start: string, end: string, grid: { startMinute: number }): { top: number; height: number } {
  return {
    top: (limaMinuteOfDay(start) - grid.startMinute) * CAL_PX_PER_MINUTE,
    height: Math.max(CAL_MIN_BLOCK_PX, minutesBetween(start, end) * CAL_PX_PER_MINUTE),
  };
}

export interface Placed<T> {
  item: T;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Citas de UN día en la grilla: por su hora y en carriles lado a lado cuando se cruzan. Orden estable por inicio. */
export function placeDay<T extends { start: string; end: string }>(items: readonly T[], grid: { startMinute: number }): Placed<T>[] {
  const sorted = items.toSorted((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const placed: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const [s, e] = [Date.parse(item.start), Date.parse(item.end)];
    if (s >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = e;
    groupEnd = group.length === 0 ? e : Math.max(groupEnd, e);
    const p = { item, ...toGrid(item.start, item.end, grid), lane, lanes: 1 };
    group.push(p);
    placed.push(p);
  }
  close();
  return placed;
}
