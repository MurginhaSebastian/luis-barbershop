import { SHOP_NAME } from "@/core/entities/site";
import type { Metadata } from "next";
import "./globals.css";
import { Bodoni_Moda, Manrope } from "next/font/google";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAssistantWhatsApp } from "@/infrastructure/container";
import { BookLink } from "@/presentation/components/landing/book-link";
import { MobileMenu } from "@/presentation/components/landing/mobile-menu";
import { SiteFooter } from "@/presentation/components/landing/site-footer";
import { container } from "@/presentation/components/landing/styles";
import { WhatsappButton } from "@/presentation/components/landing/whatsapp-button";
import { cn } from "@/presentation/lib/utils";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import { getSiteSettings } from "./site-settings";
import { SITE_URL } from "./site-url";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display" });

const TITLE = "D'luiss Barber Shop | Barbería en Las Quintanas, Trujillo — Reserva por WhatsApp";
const DESCRIPTION =
  "Fades, diseño de barba y ondulaciones en Las Quintanas, Trujillo. Reserva tu hora directo por WhatsApp.";

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
        {/* Fija: reservar y moverse por la portada quedan siempre a mano. */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className={`${container} flex items-center justify-between gap-3 py-2 md:gap-6 md:py-4`}>
            <Link href="/" className="inline-flex min-h-11 items-center font-heading text-base tracking-wide whitespace-nowrap text-primary min-[400px]:text-lg md:text-xl">
              {SHOP_NAME}
            </Link>
            <nav aria-label="Principal" className="flex items-center gap-1">
              <Suspense fallback={null}>
                <SectionLinks />
              </Suspense>
              <Suspense fallback={<BookLink className={headerBookClass}>Reservar</BookLink>}>
                <HeaderBook />
              </Suspense>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}

const headerBookClass =
  "ml-2 inline-flex min-h-11 items-center rounded-full border border-primary/60 px-4 text-sm md:px-5 text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

async function HeaderBook() {
  await connection(); // el número se lee de process.env en cada petición, no en el build
  return (
    <BookLink assistant={getAssistantWhatsApp()} className={headerBookClass}>
      Reservar
    </BookLink>
  );
}

/** Solo enlaza a las secciones que el barbero tiene visibles: en fila desde md, en un menú en el móvil. */
async function SectionLinks() {
  const { sections } = await getSiteSettings();
  const links = [
    { href: "/#servicios", label: "Servicios", visible: true },
    { href: "/#nosotros", label: "Nosotros", visible: sections.about },
    { href: "/#productos", label: "Productos", visible: sections.products },
    { href: "/#horario", label: "Horario", visible: sections.visit },
  ];
  const visible = links.filter((l) => l.visible).map(({ href, label }) => ({ href, label }));
  return (
    <>
      {visible.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="hidden min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary md:inline-flex"
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
