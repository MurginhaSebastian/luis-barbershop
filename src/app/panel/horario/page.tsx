import type { Metadata } from "next";
import { Suspense } from "react";
import { shopDateOf } from "@/core/scheduling/availability";
import { getUseCases } from "@/infrastructure/container";
import { BlocksEditor } from "@/presentation/components/panel/blocks-editor";
import { HoursEditor } from "@/presentation/components/panel/hours-editor";
import { addBlockAction, removeBlockAction, saveDayHoursAction } from "../admin-actions";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Horario" };

export default function HorarioPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-4 pb-24 sm:px-6">
      <header className="rounded-md border border-light-outline bg-light-card px-4 py-2.5 text-on-light-card sm:px-6">
        <h1 className="font-heading text-3xl">Horario</h1>
      </header>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Schedule />
      </Suspense>
    </main>
  );
}

async function Schedule() {
  await requirePanelSession();
  const { manageSchedule, manageCatalog } = getUseCases();
  const [weeklyHours, blocks, barbers] = await Promise.all([
    manageSchedule.getWeeklyHours(),
    manageSchedule.listBlocks(),
    manageCatalog.listBarbers(),
  ]);
  return (
    <div className="mt-4 space-y-6">
      <HoursEditor weeklyHours={weeklyHours} action={saveDayHoursAction} />
      <BlocksEditor
        blocks={blocks}
        barbers={barbers.filter((b) => b.active)}
        today={shopDateOf(new Date())}
        add={addBlockAction}
        remove={removeBlockAction}
      />
    </div>
  );
}
