import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { shopDateOf } from "@/core/scheduling/availability";
import { getUseCases, getVapidPublicKey } from "@/infrastructure/container";
import { AgendaView } from "@/presentation/components/panel/agenda-view";
import { AutoRefresh } from "@/presentation/components/panel/auto-refresh";
import { PushToggle } from "@/presentation/components/panel/push-toggle";
import { changeStatusAction } from "./actions";
import { sendTestPushAction, subscribePushAction, unsubscribePushAction } from "./push-actions";
import { requirePanelSession } from "./session";

export const metadata: Metadata = { title: "Agenda" };

export default function PanelPage({ searchParams }: PageProps<"/panel">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl sm:text-5xl">Agenda</h1>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Panel({ searchParams }: Pick<PageProps<"/panel">, "searchParams">) {
  await requirePanelSession();
  const today = shopDateOf(new Date());
  const date = z.iso.date().catch(today).parse((await searchParams).dia);
  const agenda = await getUseCases().getAgenda.execute({ date });
  return (
    <>
      <PushToggle
        publicKey={getVapidPublicKey()}
        subscribe={subscribePushAction}
        unsubscribe={unsubscribePushAction}
        sendTest={sendTestPushAction}
      />
      <AgendaView agenda={agenda} date={date} today={today} changeStatus={changeStatusAction} />
      <AutoRefresh />
    </>
  );
}
