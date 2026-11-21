import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { getUseCases } from "@/infrastructure/container";
import { ChatsView } from "@/presentation/components/panel/chats-view";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage({ searchParams }: PageProps<"/panel/chats">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl sm:text-5xl">Chats</h1>
      <p className="mt-1 text-sm text-muted-foreground">Lo que atiende el asistente de IA en las últimas 24 horas. Solo lectura.</p>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Chats searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Chats({ searchParams }: Pick<PageProps<"/panel/chats">, "searchParams">) {
  await requirePanelSession();
  const phone = z.string().regex(/^\d{8,15}$/).optional().catch(undefined).parse((await searchParams).c);
  const threads = await getUseCases().getChats.execute();
  return <ChatsView threads={threads} selected={threads.find((t) => t.phone === phone) ?? null} />;
}
