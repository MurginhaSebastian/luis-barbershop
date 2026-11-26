import { Scissors } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAssistantWhatsApp, getUseCases } from "@/infrastructure/container";
import { BookLink } from "@/presentation/components/landing/book-link";
import { Hero } from "@/presentation/components/landing/hero";
import { ScrollToHash } from "@/presentation/components/landing/scroll-to-hash";
import { ParaEllas } from "@/presentation/components/landing/para-ellas";
import { About, ClosingCta, HowToBook, Products, Testimonials, VisitUs, WhyUs } from "@/presentation/components/landing/sections";
import { ServiceGallery } from "@/presentation/components/landing/service-gallery";
import { ShopFacts } from "@/presentation/components/landing/shop-facts";
import { container, eyebrowLight, goldBtn, h2Light, lightGhostBtn } from "@/presentation/components/landing/styles";
import { testimonials } from "@/presentation/content/testimonials";
import { describeOpening } from "@/presentation/lib/hours";
import { jsonLdHtml, shopJsonLd } from "@/presentation/lib/json-ld";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import { SITE_URL } from "./site-url";
import { getSiteSettings } from "./site-settings";

export default function Home() {
  return (
    <main>
      {/* El armazón estático ya trae la portada; al llegar los ajustes se añade el botón de WhatsApp. */}
      <Suspense fallback={<Hero />}>
        <HeroWithSettings />
      </Suspense>

      <Suspense fallback={<p className={`${container} min-h-[40rem] bg-light-canvas py-20 text-light-muted`}>Cargando servicios…</p>}>
        <CatalogSections />
      </Suspense>

      <Suspense fallback={<ClosingCta />}>
        <ClosingWithSettings />
      </Suspense>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-dark-outline bg-dark-canvas/95 p-3 backdrop-blur md:hidden">
        <Suspense fallback={<BookLink className={barClass}>Reservar cita</BookLink>}>
          <MobileBookBar />
        </Suspense>
      </div>
    </main>
  );
}

const barClass = `${goldBtn} w-full`;

async function MobileBookBar() {
  await connection();
  return (
    <BookLink assistant={getAssistantWhatsApp()} className={barClass}>
      Reservar cita
    </BookLink>
  );
}

async function HeroWithSettings() {
  const { images } = await getSiteSettings();
  // Se lee tras esperar los ajustes (dentro de Suspense, en la petición); si la portada pasara a estática, quedaría fijado en el build.
  const assistant = getAssistantWhatsApp();
  return (
    <Hero
      assistantHref={assistant ? whatsappLink(assistant, "Hola, quiero reservar una cita") : undefined}
      image={images.hero}
    />
  );
}

async function ClosingWithSettings() {
  const { images } = await getSiteSettings();
  return <ClosingCta image={images.closing} assistant={getAssistantWhatsApp()} />;
}

async function CatalogSections() {
  const { sections, contact, images } = await getSiteSettings();
  const assistant = getAssistantWhatsApp();
  const { getCatalog } = getUseCases();
  const [{ services, products, weeklyHours }, opening] = await Promise.all([getCatalog.execute(), getCatalog.openingStatus()]);
  const barberia = services.filter((s) => (s.area ?? "barberia") === "barberia");
  const spa = services.filter((s) => s.area === "spa");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(shopJsonLd({ url: SITE_URL, contact, services, weeklyHours })) }}
      />
      <ShopFacts
        opening={describeOpening(opening, new Date())}
        isOpen={opening?.open === true}
        showHours={sections.visit}
        address={contact.address}
        mapsUrl={contact.mapsUrl}
        fromCents={services.length ? Math.min(...services.map((s) => s.priceCents)) : null}
      />
      <section id="servicios" aria-labelledby="servicios-t" className="scroll-mt-6 bg-light-canvas text-on-light-canvas">
        <div className={`${container} py-section-sm lg:py-section-lg`}>
          <div className="mx-auto flex max-w-xl flex-col items-center gap-gutter-xs text-center">
            <p className={eyebrowLight}>Barbería</p>
            <h2 id="servicios-t" className={h2Light}>
              Servicios
            </h2>
            <span aria-hidden className="mt-1 flex w-32 items-center gap-gutter-sm text-gold-on-light">
              <span className="h-px flex-1 bg-current" />
              <Scissors className="size-4" />
              <span className="h-px flex-1 bg-current" />
            </span>
          </div>
          {barberia.length > 0 ? (
            <>
              <p className="mx-auto mt-4 max-w-md text-center font-body text-body-lg text-light-muted">
                Toca un servicio para reservarlo. Puedes sumar otros en el siguiente paso.
              </p>
              <div className="mt-12">
                <ServiceGallery services={barberia} assistant={assistant} />
              </div>
            </>
          ) : (
            <div className="mt-8 text-center">
              <p className="mx-auto max-w-prose font-body text-body-lg text-light-muted">
                Estamos actualizando nuestra carta de servicios. Escríbenos y te contamos todo lo que tenemos para ti.
              </p>
              {contact.whatsapp && (
                <a
                  href={whatsappLink(contact.whatsapp, assistant ? "Hola, tengo una consulta." : undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${lightGhostBtn} mt-6`}
                >
                  Consúltanos por WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </section>
      {sections.paraEllas && (
        <ParaEllas
          services={spa}
          assistant={assistant}
          whatsappHref={contact.whatsapp ? whatsappLink(contact.whatsapp, assistant ? "Hola, tengo una consulta." : undefined) : undefined}
        />
      )}
      {sections.howToBook && <HowToBook assistant={assistant} address={contact.address} mapsUrl={contact.mapsUrl} />}
      {sections.about && <About image={images.about} />}
      {sections.whyUs && <WhyUs />}
      {sections.products && <Products products={products} image={images.products} />}
      <Testimonials items={testimonials} />
      {sections.visit && <VisitUs weeklyHours={weeklyHours} />}
      <ScrollToHash />
    </>
  );
}
