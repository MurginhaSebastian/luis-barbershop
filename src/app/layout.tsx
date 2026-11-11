import type { Metadata } from "next";
import "./globals.css";
import { Bodoni_Moda, Manrope } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { MobileMenu } from "@/presentation/components/landing/mobile-menu";
import { SiteFooter } from "@/presentation/components/landing/site-footer";
import { container } from "@/presentation/components/landing/styles";
import { WhatsappButton } from "@/presentation/components/landing/whatsapp-button";
import { cn } from "@/presentation/lib/utils";
import { whatsappLink } from "@/presentation/lib/whatsapp";
import { getSiteSettings } from "./site-settings";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Luis Barbershop", template: "%s · Luis Barbershop" },
  description: "Cortes, fades y barba. Reserva tu hora en línea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("dark font-sans", sans.variable, display.variable)}>
      <body className="flex min-h-dvh flex-col antialiased">
        {/* Fija: reservar y moverse por la portada quedan siempre a mano. */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className={`${container} flex items-center justify-between gap-3 py-2 md:gap-6 md:py-4`}>
            <Link href="/" className="inline-flex min-h-11 items-center font-heading text-base tracking-wide whitespace-nowrap text-primary min-[400px]:text-lg md:text-xl">
              Luis Barbershop
            </Link>
            <nav aria-label="Principal" className="flex items-center gap-1">
              <Suspense fallback={null}>
                <SectionLinks />
              </Suspense>
              <Link
                href="/reservar"
                className="ml-2 inline-flex min-h-11 items-center rounded-full border border-primary/60 px-4 text-sm md:px-5 text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Reservar
              </Link>
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
  const whatsappHref = contact.whatsapp && whatsappLink(contact.whatsapp);
  return (
    <>
      <SiteFooter
        whatsappHref={whatsappHref}
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
