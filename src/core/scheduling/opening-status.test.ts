import { describe, expect, test } from "vitest";
import { TimeSlot } from "../entities/time-slot";
import type { BusinessHours } from "./availability";
import { openingStatus } from "./opening-status";

const range = (open: string, close: string): BusinessHours => {
  const minute = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  return { openMinute: minute(open), closeMinute: minute(close) };
};
const workday = [range("10:00", "14:00"), range("15:00", "20:00")];
// 0 = domingo (cerrado); de lunes a sábado con pausa para almorzar.
const week = [[], workday, workday, workday, workday, workday, workday];

/** Instante a esa hora de Lima (UTC−5). */
const lima = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-05:00`);
const closure = (from: Date, to: Date) => TimeSlot.create(from, to);

// El 9 de noviembre de 2026 es lunes.
describe("openingStatus", () => {
  test("abierta: dice hasta qué hora", () => {
    expect(openingStatus(week, [], lima("2026-11-09", "11:30"))).toEqual({ open: true, until: lima("2026-11-09", "14:00") });
  });

  test("antes de abrir: abre hoy", () => {
    expect(openingStatus(week, [], lima("2026-11-09", "08:00"))).toEqual({ open: false, opensAt: lima("2026-11-09", "10:00") });
  });

  test("en la pausa del almuerzo: vuelve a las 15:00", () => {
    expect(openingStatus(week, [], lima("2026-11-09", "14:20"))).toEqual({ open: false, opensAt: lima("2026-11-09", "15:00") });
  });

  test("a la hora justa de cierre ya está cerrada", () => {
    expect(openingStatus(week, [], lima("2026-11-09", "20:00"))).toEqual({ open: false, opensAt: lima("2026-11-10", "10:00") });
  });

  test("sábado por la noche: salta el domingo cerrado", () => {
    expect(openingStatus(week, [], lima("2026-11-14", "21:00"))).toEqual({ open: false, opensAt: lima("2026-11-16", "10:00") });
  });

  test("tramos que se tocan cuentan como uno", () => {
    const continuous = [[], [range("10:00", "14:00"), range("14:00", "20:00")]];
    expect(openingStatus(continuous, [], lima("2026-11-09", "12:00"))).toEqual({ open: true, until: lima("2026-11-09", "20:00") });
  });

  test("un feriado de todo el día la deja cerrada hasta el día siguiente", () => {
    const holiday = closure(lima("2026-11-09", "00:00"), lima("2026-11-10", "00:00"));
    expect(openingStatus(week, [holiday], lima("2026-11-09", "11:00"))).toEqual({ open: false, opensAt: lima("2026-11-10", "10:00") });
  });

  test("un cierre a media tarde adelanta la hora de cierre", () => {
    const early = closure(lima("2026-11-09", "18:00"), lima("2026-11-09", "23:00"));
    expect(openingStatus(week, [early], lima("2026-11-09", "16:00"))).toEqual({ open: true, until: lima("2026-11-09", "18:00") });
  });

  test("un cierre que acaba a media mañana: abre al terminar", () => {
    const late = closure(lima("2026-11-09", "09:00"), lima("2026-11-09", "11:30"));
    expect(openingStatus(week, [late], lima("2026-11-09", "10:15"))).toEqual({ open: false, opensAt: lima("2026-11-09", "11:30") });
  });

  test("sin horario, o cerrada más de un mes, no anuncia ninguna apertura", () => {
    expect(openingStatus([[], [], [], [], [], [], []], [], lima("2026-11-09", "11:00"))).toBeNull();
    const longClosure = closure(lima("2026-11-01", "00:00"), lima("2027-01-01", "00:00"));
    expect(openingStatus(week, [longClosure], lima("2026-11-09", "11:00"))).toBeNull();
  });
});
