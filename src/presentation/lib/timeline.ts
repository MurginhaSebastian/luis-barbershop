import type { AppointmentStatus } from "@/core/entities/appointment";
import { SHOP_UTC_OFFSET_MINUTES } from "@/core/scheduling/booking-policy";

const OPERATIONAL: ReadonlySet<AppointmentStatus> = new Set(["PENDING", "CONFIRMED", "AT_RISK", "COMPLETED", "NO_SHOW"]);

/** Las que van en la grilla; canceladas y vencidas van aparte, para no confundir lo que está en pie. */
export const isOperational = (status: AppointmentStatus) => OPERATIONAL.has(status);

const minutesBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 60_000);

export interface Interval {
  start: string;
  end: string;
}

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
