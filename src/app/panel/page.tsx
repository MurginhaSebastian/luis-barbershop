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
    <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 sm:pb-24">
      {/* La barra de la agenda ya titula con la fecha: el h1 queda para lectores de pantalla. */}
      <h1 className="sr-only">Agenda</h1>
      <Suspense fallback={<p className="min-h-96 text-muted-foreground">Cargando…</p>}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Panel({ searchParams }: Pick<PageProps<"/panel">, "searchParams">) {
  await requirePanelSession();
  const today = shopDateOf(new Date());
  const params = await searchParams;
  const date = z.iso.date().catch(today).parse(params.dia);
  const view = z.enum(["dia", "semana", "mes"]).catch("dia").parse(params.vista);
  const agenda = await getUseCases().getAgenda.execute({ date, view });
  return (
    <>
      <AgendaView
        agenda={agenda}
        date={date}
        today={today}
        changeStatus={changeStatusAction}
        extra={
          <PushToggle
            // Elemento de servidor que pasa por componentes cliente: al navegar sin recargar, React lo exige con key.
            key="push"
            publicKey={getVapidPublicKey()}
            subscribe={subscribePushAction}
            unsubscribe={unsubscribePushAction}
            sendTest={sendTestPushAction}
          />
        }
      />
      <AutoRefresh />
    </>
  );
}
