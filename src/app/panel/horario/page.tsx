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
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl">Horario</h1>
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
    <div className="mt-6 space-y-10">
      <section aria-labelledby="bloqueos">
        <h2 id="bloqueos" className="font-heading text-3xl">
          Días bloqueados
        </h2>
        <p className="mt-1 text-muted-foreground">Vacaciones, feriados o ausencias. Esas horas dejan de ofrecerse.</p>
        <BlocksEditor
          blocks={blocks}
          barbers={barbers.filter((b) => b.active)}
          today={shopDateOf(new Date())}
          add={addBlockAction}
          remove={removeBlockAction}
        />
      </section>
      <section aria-labelledby="horario-semanal">
        <h2 id="horario-semanal" className="font-heading text-3xl">
          Horario semanal
        </h2>
        <p className="mt-1 text-muted-foreground">Común a todos los barberos. Deja un día vacío para cerrarlo.</p>
        <HoursEditor weeklyHours={weeklyHours} action={saveDayHoursAction} />
      </section>
    </div>
  );
}
