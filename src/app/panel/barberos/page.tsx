import type { Metadata } from "next";
import { Suspense } from "react";
import { AREA_LABEL, SERVICE_AREAS } from "@/core/entities/catalog";
import { getUseCases } from "@/infrastructure/container";
import { EditableList } from "@/presentation/components/panel/editable-list";
import { saveBarberAction } from "../admin-actions";
import { requirePanelSession } from "../session";

const areaOptions = SERVICE_AREAS.map((value) => ({ value, label: AREA_LABEL[value] }));

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
  const owner = barbers.find((b) => b.isOwner);
  return (
    <>
      {owner && <p className="mt-6 rounded-lg border border-border px-4 py-3 font-medium">{owner.name} · Dueño · {(owner.areas ?? ["barberia"]).map((a) => AREA_LABEL[a]).join(", ")}</p>}
      <EditableList
        addHeading="Añadir barbero"
        action={saveBarberAction}
        fields={[
          { name: "name", label: "Nombre" },
          { name: "areas", label: "Áreas", options: areaOptions, multiple: true },
        ]}
        items={barbers.filter((b) => !b.isOwner).map((b) => ({ id: b.id, title: b.name, active: b.active, subtitle: (b.areas ?? ["barberia"]).map((a) => AREA_LABEL[a]).join(", "), values: { name: b.name, areas: (b.areas ?? ["barberia"]).join(",") } }))}
      />
    </>
  );
}
