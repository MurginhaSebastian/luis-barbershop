import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { photoFor } from "@/presentation/components/landing/service-gallery";
import { PhotoEditor } from "@/presentation/components/panel/photo-editor";
import { ContactForm, SectionsForm } from "@/presentation/components/panel/site-editor";
import { requirePanelSession } from "../session";
import { removeImageAction, saveContactAction, saveSectionsAction, uploadImageAction } from "../site-actions";

const CARD = "rounded-md border border-light-outline bg-light-card p-4 text-on-light-card sm:p-6";

export const metadata: Metadata = { title: "Web" };

export default function WebPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-24 sm:px-6">
      <header className="rounded-md border border-light-outline bg-light-card px-4 py-2.5 text-on-light-card sm:px-6">
        <h1 className="font-heading text-3xl">Web</h1>
        <p className="text-sm text-light-muted">Lo que guardes aquí se ve en la portada al momento.</p>
      </header>
      <Suspense fallback={<p className="mt-6 min-h-96 text-muted-foreground">Cargando…</p>}>
        <SiteSettingsEditor />
      </Suspense>
    </main>
  );
}

async function SiteSettingsEditor() {
  await requirePanelSession();
  const { manageSite, manageCatalog } = getUseCases();
  const [settings, services] = await Promise.all([manageSite.get(), manageCatalog.listServices()]);
  const { images } = settings;
  const slots = [
    {
      target: "hero",
      label: "Portada",
      hint: "La portada es un video; esta foto se ve mientras carga y para quien no lo reproduce.",
      current: images.hero,
      fallback: "/videos/portadas.jpg",
    },
    { target: "about", label: "Nosotros", current: images.about, fallback: "/images/sillon.jpg" },
    { target: "products", label: "Productos", current: images.products, fallback: "/images/herramientas.jpg" },
    { target: "closing", label: "Cierre de la portada", current: images.closing, fallback: "/images/tijeras.jpg" },
    ...services.map((s) => ({ target: `service:${s.id}`, label: `Servicio: ${s.name}`, current: s.imageUrl, fallback: photoFor(s) })),
  ];
  return (
    <div className="mt-4 space-y-6">
      <section aria-labelledby="contacto" className={CARD}>
        <h2 id="contacto" className="mb-4 text-lg font-semibold">
          Contacto
        </h2>
        <ContactForm contact={settings.contact} action={saveContactAction} />
      </section>
      <section aria-labelledby="fotos" className={CARD}>
        <h2 id="fotos" className="text-lg font-semibold">
          Fotos
        </h2>
        {manageSite.canUploadImages ? (
          <>
            <p className="mt-1 text-sm text-light-muted">Se reducen y se les quitan los datos de ubicación al subirlas.</p>
            <PhotoEditor slots={slots} upload={uploadImageAction} remove={removeImageAction} />
          </>
        ) : (
          <p className="mt-3 rounded-sm border border-gold-on-light bg-light-canvas p-4 text-sm">
            Para subir fotos falta configurar dónde guardarlas (Supabase Storage). Mientras tanto se ven las de ejemplo.
          </p>
        )}
      </section>
      <section aria-labelledby="secciones" className={CARD}>
        <h2 id="secciones" className="mb-4 text-lg font-semibold">
          Secciones visibles
        </h2>
        <SectionsForm sections={settings.sections} action={saveSectionsAction} />
      </section>
    </div>
  );
}
