import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { EditableList } from "@/presentation/components/panel/editable-list";
import { saveProductAction } from "../admin-actions";
import { requirePanelSession } from "../session";

export const metadata: Metadata = { title: "Productos" };

export default function ProductosPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl">Productos</h1>
      <p className="mt-2 text-muted-foreground">Los clientes los ven en la web y pueden pedirlos al reservar.</p>
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
    <EditableList
      addHeading="Añadir producto"
      action={saveProductAction}
      fields={[
        { name: "name", label: "Nombre" },
        { name: "price", label: "Precio (S/)", inputMode: "decimal" },
      ]}
      items={products.map((p) => ({
        id: p.id,
        title: p.name,
        active: p.active,
        values: { name: p.name, price: (p.priceCents / 100).toFixed(2) },
      }))}
    />
  );
}
