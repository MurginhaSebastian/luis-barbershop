import { refresh } from "next/cache";
import type { z } from "zod";
import { DomainError } from "@/core/errors/domain-errors";
import type { AdminState } from "@/presentation/components/panel/admin-state";

/** Traduce el resultado a la pantalla. Cada acción comprueba la sesión antes de llamarla. */
export async function runAdmin(work: () => Promise<AdminState>): Promise<AdminState> {
  try {
    const state = await work();
    refresh();
    return state;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    console.error("panel", error);
    return { error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

export const firstIssue = (error: z.ZodError): AdminState => ({ error: error.issues[0]?.message ?? "Revisa los datos." });
