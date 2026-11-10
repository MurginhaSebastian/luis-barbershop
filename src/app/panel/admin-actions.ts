"use server";

import { z } from "zod";
import { TimeSlot } from "@/core/entities/time-slot";
import { getUseCases } from "@/infrastructure/container";
import type { AdminState } from "@/presentation/components/panel/admin-state";
import { parseBarberForm, parseBlockForm, parseHoursForm, parseProductForm, parseServiceForm } from "./admin-schema";
import { firstIssue, runAdmin as run } from "./run-admin";
import { requirePanelSession } from "./session";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export async function saveServiceAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseServiceForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return run(async () => {
    await getUseCases().manageCatalog.saveService(parsed.data);
    return { ok: "Guardado." };
  });
}

export async function saveProductAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseProductForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return run(async () => {
    await getUseCases().manageCatalog.saveProduct(parsed.data);
    return { ok: "Guardado." };
  });
}

export async function saveBarberAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseBarberForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return run(async () => {
    const { upcoming } = await getUseCases().manageCatalog.saveBarber(parsed.data);
    if (upcoming === 0) return { ok: "Guardado." };
    const citas = plural(upcoming, "1 cita por venir", `${upcoming} citas por venir`);
    return { ok: "Guardado.", warning: `Tiene ${citas}: sigue en la agenda hasta que la gestiones.` };
  });
}

export async function saveDayHoursAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseHoursForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return run(async () => {
    await getUseCases().manageSchedule.saveDayHours(parsed.data.weekday, parsed.data.hours);
    return { ok: "Guardado." };
  });
}

export async function addBlockAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseBlockForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return run(async () => {
    const { barberId, start, end, reason } = parsed.data;
    const slot = TimeSlot.create(start, end);
    const { conflicts } = await getUseCases().manageSchedule.addBlock({ barberId, slot, reason });
    if (conflicts === 0) return { ok: "Bloqueo añadido." };
    const citas = plural(conflicts, "1 cita ya reservada", `${conflicts} citas ya reservadas`);
    return { ok: "Bloqueo añadido.", warning: `Hay ${citas} en ese periodo: revísalas en la agenda, no se cancelan solas.` };
  });
}

export async function removeBlockAction(id: string): Promise<AdminState> {
  await requirePanelSession();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "No se pudo identificar el bloqueo." };
  return run(async () => {
    await getUseCases().manageSchedule.removeBlock(parsed.data);
    return { ok: "Bloqueo eliminado." };
  });
}
