import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { EditableList } from "@/presentation/components/panel/editable-list";
import { saveBarberAction } from "../admin-actions";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Barberos" };

export default function BarberosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl">Barberos</h1>
      <p className="mt-2 text-muted-foreground">Ocultar a un barbero evita nuevas reservas; sus citas no se cancelan.</p>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Barbers />
      </Suspense>
    </main>
  );
}

async function Barbers() {
  await requirePanelSession();
  const barbers = await getUseCases().manageCatalog.listBarbers();
  return (
    <EditableList
      addHeading="Añadir barbero"
      action={saveBarberAction}
      fields={[{ name: "name", label: "Nombre" }]}
      items={barbers.map((b) => ({ id: b.id, title: b.name, active: b.active, values: { name: b.name } }))}
    />
  );
}
