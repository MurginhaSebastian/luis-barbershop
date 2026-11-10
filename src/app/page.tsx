import Link from "next/link";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { Hero } from "@/presentation/components/landing/hero";
import { ScrollToHash } from "@/presentation/components/landing/scroll-to-hash";
import { About, ClosingCta, HowToBook, Products, Testimonials, VisitUs, WhyUs } from "@/presentation/components/landing/sections";
import { ServiceGallery } from "@/presentation/components/landing/service-gallery";
import { container, ctaClass, sectionTitle } from "@/presentation/components/landing/styles";
import { testimonials } from "@/presentation/content/testimonials";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import { getSiteSettings } from "./site-settings";

export default function Home() {
  return (
    <main>
      {/* El armazón estático ya trae la portada; al llegar los ajustes se añade el botón de WhatsApp. */}
      <Suspense fallback={<Hero />}>
        <HeroWithSettings />
      </Suspense>

      <Suspense fallback={<p className={`${container} min-h-[40rem] py-20 text-muted-foreground`}>Cargando servicios…</p>}>
        <CatalogSections />
      </Suspense>

      <Suspense fallback={<ClosingCta />}>
        <ClosingWithSettings />
      </Suspense>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Link href="/reservar" className={`${ctaClass} w-full`}>
          Reservar cita
        </Link>
      </div>
    </main>
  );
}

async function HeroWithSettings() {
  const { contact, images } = await getSiteSettings();
  return <Hero whatsappHref={contact.whatsapp && whatsappLink(contact.whatsapp)} image={images.hero} />;
}

async function ClosingWithSettings() {
  const { images } = await getSiteSettings();
  return <ClosingCta image={images.closing} />;
}

async function CatalogSections() {
  const { sections, contact, images } = await getSiteSettings();
  const { services, products, weeklyHours } = await getUseCases().getCatalog.execute();
  return (
    <>
      <section id="servicios" aria-labelledby="servicios-t" className={`${container} scroll-mt-6 py-20`}>
        <h2 id="servicios-t" className={sectionTitle}>
          Servicios
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          Toca un servicio para reservarlo. Puedes sumar otros en el siguiente paso.
        </p>
        <div className="mt-10">
          <ServiceGallery services={services} />
        </div>
      </section>
      {sections.about && <About image={images.about} />}
      {sections.whyUs && <WhyUs />}
      {sections.howToBook && <HowToBook />}
      {sections.products && <Products products={products} image={images.products} />}
      <Testimonials items={testimonials} />
      {sections.visit && <VisitUs weeklyHours={weeklyHours} address={contact.address} mapsUrl={contact.mapsUrl} />}
      <ScrollToHash />
    </>
  );
}
