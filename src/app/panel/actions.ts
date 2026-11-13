"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppointmentStatus } from "@/core/entities/appointment";
import { DomainError } from "@/core/errors/domain-errors";
import { LoginThrottle } from "@/infrastructure/auth/login-throttle";
import { verifyPassword } from "@/infrastructure/auth/password";
import { getPanelConfig } from "@/infrastructure/auth/session";
import { getUseCases } from "@/infrastructure/container";
import type { LoginState } from "@/presentation/components/panel/login-form";
import { endPanelSession, requirePanelSession, startPanelSession } from "./session";

const MAX_PASSWORD_LENGTH = 200;
const throttle = new LoginThrottle();

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const config = getPanelConfig();
  if (!config) return { error: "El panel aún no está configurado." };

  // shortcut: la IP viene de la cabecera del proxy; revisar cuál es de fiar al elegir el hosting.
  const origin = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = new Date();
  if (throttle.isBlocked(origin, now)) return { error: "Demasiados intentos. Espera 15 minutos." };

  const password = form.get("password");
  const valid =
    typeof password === "string" &&
    password.length <= MAX_PASSWORD_LENGTH &&
    (await verifyPassword(password, config.passwordHash));
  if (!valid) {
    throttle.recordFailure(origin, now);
    return { error: "La clave no es correcta." };
  }

  throttle.reset(origin);
  await startPanelSession(config.sessionSecret);
  redirect("/panel");
}

// Vencer es cosa del sistema (plazo de confirmación), no un botón del panel.
const statusChange = z.object({ id: z.uuid(), status: z.enum(AppointmentStatus).exclude(["EXPIRED"]) });

export async function changeStatusAction(id: string, status: AppointmentStatus): Promise<{ error?: string }> {
  await requirePanelSession();
  const parsed = statusChange.safeParse({ id, status });
  if (!parsed.success) return { error: "No se pudo identificar la cita." };

  try {
    await getUseCases().changeAppointmentStatus.execute(parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    console.error("changeStatusAction", error);
    return { error: "No se pudo guardar el cambio. Inténtalo de nuevo." };
  }
  refresh();
  return {};
}

export async function logoutAction(): Promise<void> {
  await endPanelSession();
  redirect("/panel/entrar");
}
