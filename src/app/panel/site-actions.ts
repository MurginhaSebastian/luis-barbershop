"use server";

import { MAX_IMAGE_BYTES } from "@/core/entities/image";
import { getUseCases } from "@/infrastructure/container";
import type { AdminState } from "@/presentation/components/panel/admin-state";
import { firstIssue, runAdmin } from "./run-admin";
import { requirePanelSession } from "./session";
import { parseContactForm, parseImageTarget, parseSectionsForm } from "./site-schema";

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

export async function uploadImageAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const target = parseImageTarget(form.get("target"));
  if (!target) return { error: "No se pudo identificar qué foto cambiar." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto." };
  // Antes de leerla entera: el contenido y el tipo real los comprueba el caso de uso.
  if (file.size > MAX_IMAGE_BYTES) return { error: "La foto pesa más de 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return runAdmin(async () => {
    const site = getUseCases().manageSite;
    if (target.kind === "slot") await site.setImage(target.slot, bytes);
    else await site.setServiceImage(target.serviceId, bytes);
    return { ok: "Foto actualizada. Ya se ve en la web." };
  });
}

export async function removeImageAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requirePanelSession();
  const target = parseImageTarget(form.get("target"));
  if (!target) return { error: "No se pudo identificar qué foto quitar." };
  return runAdmin(async () => {
    const site = getUseCases().manageSite;
    if (target.kind === "slot") await site.removeImage(target.slot);
    else await site.removeServiceImage(target.serviceId);
    return { ok: "Vuelve a verse la foto de ejemplo." };
  });
}
