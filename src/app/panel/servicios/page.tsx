import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { EditableList } from "@/presentation/components/panel/editable-list";
import { saveServiceAction } from "../admin-actions";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Servicios" };

export default function ServiciosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl">Servicios</h1>
      <p className="mt-2 text-muted-foreground">
        Los cambios se ven en la web al guardar. Las citas ya reservadas conservan su precio.
      </p>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Services />
      </Suspense>
    </main>
  );
}

async function Services() {
  await requirePanelSession();
  const services = await getUseCases().manageCatalog.listServices();
  return (
    <EditableList
      addHeading="Añadir servicio"
      action={saveServiceAction}
      fields={[
        { name: "name", label: "Nombre" },
        { name: "durationMinutes", label: "Duración (minutos)", inputMode: "numeric", hint: "De 5 en 5, hasta 240." },
        { name: "price", label: "Precio (S/)", inputMode: "decimal" },
      ]}
      items={services.map((s) => ({
        id: s.id,
        title: s.name,
        active: s.active,
        values: { name: s.name, durationMinutes: String(s.durationMinutes), price: (s.priceCents / 100).toFixed(2) },
      }))}
    />
  );
}
