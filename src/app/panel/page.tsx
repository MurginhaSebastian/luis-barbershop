import type { Metadata } from "next";
import { Suspense } from "react";
import { logoutAction } from "./actions";
import { requirePanelSession } from "./session";

export const metadata: Metadata = { title: "Agenda" };

export default function PanelPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl sm:text-5xl">Agenda</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Cargando…</p>}>
        <Panel />
      </Suspense>
    </main>
  );
}

async function Panel() {
  await requirePanelSession();
  return (
    <form action={logoutAction} className="mt-6">
      <button type="submit" className="min-h-11 cursor-pointer text-muted-foreground underline underline-offset-4">
        Cerrar sesión
      </button>
    </form>
  );
}
