import type { Metadata } from "next";
import { Suspense } from "react";
import { AREA_LABEL, SERVICE_AREAS } from "@/core/entities/catalog";
import { getUseCases } from "@/infrastructure/container";
import { CatalogGrid } from "@/presentation/components/panel/catalog-grid";
import { saveBarberAction } from "../admin-actions";
import { requirePanelSession } from "../session";

const areaOptions = SERVICE_AREAS.map((value) => ({ value, label: AREA_LABEL[value] }));

export const metadata: Metadata = { title: "Barberos" };

export default function BarberosPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6">
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Barbers />
      </Suspense>
    </main>
  );
}

async function Barbers() {
  await requirePanelSession();
  const barbers = await getUseCases().manageCatalog.listBarbers();
  const areasOf = (b: (typeof barbers)[number]) => b.areas ?? ["barberia"];
  return (
    <CatalogGrid
      title="Barberos"
      note="Ocultar a un barbero evita nuevas reservas; sus citas no se cancelan."
      addLabel="Nuevo profesional"
      addHeading="Añadir barbero"
      states={["Activo", "Inactivo"]}
      action={saveBarberAction}
      fields={[
        { name: "name", label: "Nombre" },
        { name: "areas", label: "Áreas", options: areaOptions, multiple: true },
      ]}
      items={[...barbers].sort((a, b) => Number(b.isOwner) - Number(a.isOwner)).map((b) => ({
        id: b.id,
        title: b.name,
        active: b.active,
        avatar: true,
        badges: areasOf(b).map((a) => ({ label: AREA_LABEL[a], tone: a === "spa" ? "spa" : "dark" })),
        lockedNote: b.isOwner ? "Perfil principal siempre activo" : undefined,
        srLabel: b.isOwner ? `${b.name} · Dueño · ${areasOf(b).map((a) => AREA_LABEL[a]).join(", ")}` : undefined,
        values: { name: b.name, areas: areasOf(b).join(",") },
      }))}
    />
  );
}
