import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/presentation/components/panel/login-form";
import { loginAction } from "../actions";
import { hasPanelSession } from "../session";

export const metadata: Metadata = { title: "Entrar al panel" };

export default function EntrarPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="font-heading text-4xl">Panel de la barbería</h1>
      <p className="mt-2 text-muted-foreground">Escribe la clave para ver la agenda.</p>
      <LoginForm action={loginAction} />
      <Suspense>
        <RedirectIfLoggedIn />
      </Suspense>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  if (await hasPanelSession()) redirect("/panel");
  return null;
}
