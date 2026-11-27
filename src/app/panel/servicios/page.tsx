import type { Metadata } from "next";
import { Suspense } from "react";
import { AREA_LABEL, SERVICE_AREAS } from "@/core/entities/catalog";
import { getUseCases } from "@/infrastructure/container";
import { CatalogGrid } from "@/presentation/components/panel/catalog-grid";
import { formatPrice } from "@/presentation/lib/format";
import { saveServiceAction } from "../admin-actions";
import { requirePanelSession } from "../session";

const areaOptions = SERVICE_AREAS.map((value) => ({ value, label: AREA_LABEL[value] }));

export const metadata: Metadata = { title: "Servicios" };

export default function ServiciosPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6">
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
    <CatalogGrid
      title="Servicios"
      note="Los cambios se ven en la web al guardar. Las citas ya reservadas conservan su precio."
      addLabel="Nuevo servicio"
      addHeading="Añadir servicio"
      action={saveServiceAction}
      filters={areaOptions}
      fields={[
        { name: "name", label: "Nombre" },
        { name: "durationMinutes", label: "Duración (minutos)", inputMode: "numeric", hint: "De 5 en 5, hasta 240." },
        { name: "price", label: "Precio (S/)", inputMode: "decimal" },
        { name: "area", label: "Área", options: areaOptions },
      ]}
      items={services.map((s) => {
        const area = s.area ?? "barberia";
        return {
          id: s.id,
          title: s.name,
          meta: `${s.durationMinutes} min`,
          price: formatPrice(s.priceCents),
          badge: { label: area === "spa" ? "Spa" : "Barbería", tone: area === "spa" ? "spa" : "dark" },
          group: area,
          active: s.active,
          values: { name: s.name, durationMinutes: String(s.durationMinutes), price: (s.priceCents / 100).toFixed(2), area },
        };
      })}
    />
  );
}
