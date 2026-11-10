"use server";

import { getUseCases } from "@/infrastructure/container";
import type { AdminState } from "@/presentation/components/panel/admin-state";
import { firstIssue, runAdmin } from "./run-admin";
import { requirePanelSession } from "./session";
import { parseContactForm, parseSectionsForm } from "./site-schema";

export async function saveContactAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const parsed = parseContactForm(form);
  if (!parsed.success) return firstIssue(parsed.error);
  return runAdmin(async () => {
    await getUseCases().manageSite.saveContact(parsed.data);
    return { ok: "Guardado. Ya se ve en la web." };
  });
}

export async function saveSectionsAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const sections = parseSectionsForm(form);
  return runAdmin(async () => {
    await getUseCases().manageSite.saveSections(sections);
    return { ok: "Guardado. Ya se ve en la web." };
  });
}
