import type { Metadata } from "next";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { ContactForm, SectionsForm } from "@/presentation/components/panel/site-editor";
import { requirePanelSession } from "../session";
import { saveContactAction, saveSectionsAction } from "../site-actions";

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
  const settings = await getUseCases().manageSite.get();
  return (
    <div className="mt-6 space-y-10">
      <section aria-labelledby="contacto">
        <h2 id="contacto" className="font-heading text-3xl">
          Contacto
        </h2>
        <ContactForm contact={settings.contact} action={saveContactAction} />
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
