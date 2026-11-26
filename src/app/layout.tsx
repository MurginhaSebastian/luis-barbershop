import { SHOP_NAME } from "@/core/entities/site";
import type { Metadata } from "next";
import "./globals.css";
import { Playfair_Display, Poppins } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAssistantWhatsApp, getUseCases } from "@/infrastructure/container";
import { MotionProvider } from "@/presentation/components/motion-provider";
import { BookLink } from "@/presentation/components/landing/book-link";
import { HomeOnly } from "@/presentation/components/landing/home-only";
import { TopBar } from "@/presentation/components/landing/top-bar";
import { describeOpening } from "@/presentation/lib/hours";
import { MobileMenu } from "@/presentation/components/landing/mobile-menu";
import { SiteFooter } from "@/presentation/components/landing/site-footer";
import { container, goldBtn } from "@/presentation/components/landing/styles";
import { WhatsappButton } from "@/presentation/components/landing/whatsapp-button";
import { cn } from "@/presentation/lib/utils";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import { getSiteSettings } from "./site-settings";
import { SITE_URL } from "./site-url";

const sans = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

const TITLE = "D'luiss Barber Shop | Barbería en Las Quintanas, Trujillo — Reserva por WhatsApp";
const DESCRIPTION =
  "Fades, diseño de barba, ondulaciones y spa para mujeres en Las Quintanas, Trujillo. Reserva tu hora directo por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${SHOP_NAME}` },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: SHOP_NAME, locale: "es_PE", type: "website", url: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("dark font-sans", sans.variable, display.variable)}>
      <body className="flex min-h-dvh flex-col antialiased">
        <MotionProvider>
          {/* Solo la portada: dirección, abierto ahora y redes. El hueco reservado evita el salto al llegar los datos. */}
          <HomeOnly>
            <Suspense fallback={<div aria-hidden className="h-9 bg-obsidian-bar" />}>
              <HomeTopBar />
            </Suspense>
          </HomeOnly>
          {/* Fija: reservar y moverse por la portada quedan siempre a mano. */}
          <header className="sticky top-0 z-30 border-b border-dark-outline bg-dark-canvas text-on-dark-canvas">
            <div className={`${container} flex h-16 items-center justify-between gap-3 md:h-20`}>
              <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-gutter-sm">
                <Image src="/images/logo.webp" alt={SHOP_NAME} width={52} height={52} sizes="48px" preload className="size-11 shrink-0 md:size-12" />
                <span aria-hidden className="hidden font-headline text-title-lg tracking-wide min-[420px]:inline xl:hidden 2xl:inline">
                  {SHOP_NAME}
                </span>
              </Link>
              <nav aria-label="Principal" className="flex items-center gap-1">
                <Suspense fallback={null}>
                  <SectionLinks />
                </Suspense>
                <Suspense fallback={<BookLink className={headerBookClass}>Reservar cita</BookLink>}>
                  <HeaderBook />
                </Suspense>
              </nav>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </MotionProvider>
      </body>
    </html>
  );
}

const headerBookClass = `ml-2 min-h-11! px-3! sm:px-5! ${goldBtn}`;

async function HeaderBook() {
  await connection(); // el número se lee de process.env en cada petición, no en el build
  const assistant = getAssistantWhatsApp();
  return (
    <BookLink assistant={assistant} className={headerBookClass}>
      {assistant ? (
        <>
          <span className="sm:hidden">Reservar</span>
          <span className="max-sm:hidden">Reservar por WhatsApp</span>
        </>
      ) : (
        "Reservar cita"
      )}
    </BookLink>
  );
}

async function HomeTopBar() {
  const { contact } = await getSiteSettings();
  const opening = await getUseCases().getCatalog.openingStatus();
  return (
    <TopBar
      address={contact.address}
      opening={describeOpening(opening, new Date())}
      isOpen={opening?.open === true}
      socials={[
        { label: "Instagram", href: contact.instagramUrl },
        { label: "Facebook", href: contact.facebookUrl },
        { label: "TikTok", href: contact.tiktokUrl },
      ]}
    />
  );
}

/** Solo enlaza a las secciones que el barbero tiene visibles: en fila desde xl, en un menú debajo. */
async function SectionLinks() {
  const { sections, contact } = await getSiteSettings();
  const links = [
    { href: "/#servicios", label: "Servicios", visible: true },
    { href: "/#para-ellas", label: "Para ellas", visible: sections.paraEllas },
    { href: "/#nosotros", label: "Nosotros", visible: sections.about },
    { href: "/#productos", label: "Productos", visible: sections.products },
    { href: "/#como-reservar", label: "Cómo reservar", visible: sections.howToBook },
    { href: "/#ubicacion", label: "Ubicación", visible: sections.howToBook && !!contact.address },
    { href: "/#horario", label: "Horario", visible: sections.visit },
  ];
  const visible = links.filter((l) => l.visible).map(({ href, label }) => ({ href, label }));
  return (
    <>
      {visible.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="hidden min-h-11 items-center px-3 font-label text-label-lg text-on-dark-canvas transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-gold xl:inline-flex"
        >
          {l.label}
        </Link>
      ))}
      <MobileMenu links={visible} />
    </>
  );
}

async function Footer() {
  const { contact } = await getSiteSettings();
  const assistant = getAssistantWhatsApp();
  // Con el asistente activo, las reservas van a él: el contacto de Luis es solo para consultas.
  const whatsappHref = contact.whatsapp && whatsappLink(contact.whatsapp, assistant ? "Hola, tengo una consulta." : undefined);
  return (
    <>
      <SiteFooter
        whatsappHref={whatsappHref}
        assistant={assistant}
        address={contact.address}
        mapsUrl={contact.mapsUrl}
        complaintsUrl={contact.complaintsUrl}
        socials={[
          { label: "Instagram", href: contact.instagramUrl },
          { label: "Facebook", href: contact.facebookUrl },
          { label: "TikTok", href: contact.tiktokUrl },
        ]}
      />
      {whatsappHref && <WhatsappButton href={whatsappHref} />}
    </>
  );
}
