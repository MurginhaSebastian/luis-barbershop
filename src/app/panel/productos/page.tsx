import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { CatalogGrid } from "@/presentation/components/panel/catalog-grid";
import { formatPrice } from "@/presentation/lib/format";
import { saveProductAction } from "../admin-actions";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Productos" };

export default function ProductosPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6">
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <Products />
      </Suspense>
    </main>
  );
}

async function Products() {
  await requirePanelSession();
  const products = await getUseCases().manageCatalog.listProducts();
  return (
    <CatalogGrid
      title="Productos"
      note="Los clientes los ven en la web y pueden pedirlos al reservar."
      addLabel="Nuevo producto"
      addHeading="Añadir producto"
      action={saveProductAction}
      fields={[
        { name: "name", label: "Nombre" },
        { name: "price", label: "Precio (S/)", inputMode: "decimal" },
      ]}
      items={products.map((p) => ({
        id: p.id,
        title: p.name,
        price: formatPrice(p.priceCents),
        active: p.active,
        values: { name: p.name, price: (p.priceCents / 100).toFixed(2) },
      }))}
    />
  );
}
