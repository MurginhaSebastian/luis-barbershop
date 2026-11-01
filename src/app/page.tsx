import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getShopContact } from "@/infrastructure/config/shop-contact";
import { getUseCases } from "@/infrastructure/container";
import { Hero } from "@/presentation/components/landing/hero";
import { About, ClosingCta, HowToBook, Products, Testimonials, VisitUs, WhyUs } from "@/presentation/components/landing/sections";
import { ServiceGallery } from "@/presentation/components/landing/service-gallery";
import { container, ctaClass, sectionTitle } from "@/presentation/components/landing/styles";
import { testimonials } from "@/presentation/content/testimonials";
import { whatsappLink } from "@/presentation/lib/whatsapp";

export default function Home() {
  const contact = getShopContact();
  return (
    <main>
      <Hero whatsappHref={contact.whatsapp && whatsappLink(contact.whatsapp)} />

      <Suspense fallback={<p className={`${container} min-h-[40rem] py-20 text-muted-foreground`}>Cargando servicios…</p>}>
        <CatalogSections address={contact.address} mapsUrl={contact.mapsUrl} />
      </Suspense>

      <ClosingCta />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Link href="/reservar" className={`${ctaClass} w-full`}>
          Reservar cita
        </Link>
      </div>
    </main>
  );
}

async function CatalogSections({ address, mapsUrl }: { address?: string; mapsUrl?: string }) {
  await connection();
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
      <About />
      <WhyUs />
      <HowToBook />
      <Products products={products} />
      <Testimonials items={testimonials} />
      <VisitUs weeklyHours={weeklyHours} address={address} mapsUrl={mapsUrl} />
    </>
  );
}
