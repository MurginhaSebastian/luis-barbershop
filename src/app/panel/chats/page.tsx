import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { aiAssistantEnabled } from "@/infrastructure/assistant/select-assistant";
import { getUseCases } from "@/infrastructure/container";
import { ChatsView } from "@/presentation/components/panel/chats-view";
import { getSiteSettings } from "../../site-settings";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage({ searchParams }: PageProps<"/panel/chats">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-24 sm:px-6">
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
  const { contact } = await getSiteSettings();
  return (
    <ChatsView
      threads={threads}
      selected={threads.find((t) => t.phone === phone) ?? null}
      aiEnabled={aiAssistantEnabled(process.env)}
      address={contact.address}
      mapsUrl={contact.mapsUrl}
    />
  );
}
