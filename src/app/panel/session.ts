import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, getPanelConfig, isValidSessionToken, SESSION_HOURS } from "@/infrastructure/auth/session";

const COOKIE = "panel_session";

export async function hasPanelSession(): Promise<boolean> {
  const config = getPanelConfig();
  if (!config) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return isValidSessionToken(token, config.sessionSecret, new Date());
}

/** Cada página y cada acción del panel la llama: proteger la página no protege sus acciones. */
export async function requirePanelSession(): Promise<void> {
  if (!(await hasPanelSession())) redirect("/panel/entrar");
}

export async function startPanelSession(sessionSecret: string): Promise<void> {
  (await cookies()).set(COOKIE, createSessionToken(sessionSecret, new Date()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/panel",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endPanelSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/panel" });
}
