import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { photoFor } from "@/presentation/components/landing/service-gallery";
import { PhotoEditor } from "@/presentation/components/panel/photo-editor";
import { ContactForm, SectionsForm } from "@/presentation/components/panel/site-editor";
import { requirePanelSession } from "../session";
import { removeImageAction, saveContactAction, saveSectionsAction, uploadImageAction } from "../site-actions";

export const metadata: Metadata = { title: "Web" };

export default function WebPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
      <h1 className="font-heading text-4xl">Web</h1>
      <p className="mt-2 text-muted-foreground">Lo que guardes aquí se ve en la portada al momento.</p>
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
      fallback: "/videos/corte-escritorio.jpg",
    },
    { target: "about", label: "Nosotros", current: images.about, fallback: "/images/sillon.jpg" },
    { target: "products", label: "Productos", current: images.products, fallback: "/images/herramientas.jpg" },
    { target: "closing", label: "Cierre de la portada", current: images.closing, fallback: "/images/tijeras.jpg" },
    ...services.map((s) => ({ target: `service:${s.id}`, label: `Servicio: ${s.name}`, current: s.imageUrl, fallback: photoFor(s) })),
  ];
  return (
    <div className="mt-6 space-y-10">
      <section aria-labelledby="contacto">
        <h2 id="contacto" className="font-heading text-3xl">
          Contacto
        </h2>
        <ContactForm contact={settings.contact} action={saveContactAction} />
      </section>
      <section aria-labelledby="fotos">
        <h2 id="fotos" className="font-heading text-3xl">
          Fotos
        </h2>
        {manageSite.canUploadImages ? (
          <>
            <p className="mt-1 text-muted-foreground">Se reducen y se les quitan los datos de ubicación al subirlas.</p>
            <PhotoEditor slots={slots} upload={uploadImageAction} remove={removeImageAction} />
          </>
        ) : (
          <p className="mt-2 rounded-xl border border-border p-4">
            Para subir fotos falta configurar dónde guardarlas (Supabase Storage). Mientras tanto se ven las de ejemplo.
          </p>
        )}
      </section>
      <section aria-labelledby="secciones">
        <h2 id="secciones" className="font-heading text-3xl">
          Secciones de la portada
        </h2>
        <SectionsForm sections={settings.sections} action={saveSectionsAction} />
      </section>
    </div>
  );
}
