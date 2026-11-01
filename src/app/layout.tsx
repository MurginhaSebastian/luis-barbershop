import type { Metadata } from "next";
import "./globals.css";
import { Bodoni_Moda, Manrope } from "next/font/google";
import Link from "next/link";
import { getShopContact } from "@/infrastructure/config/shop-contact";
import { SiteFooter } from "@/presentation/components/landing/site-footer";
import { container } from "@/presentation/components/landing/styles";
import { WhatsappButton } from "@/presentation/components/landing/whatsapp-button";
import { cn } from "@/presentation/lib/utils";
import { whatsappLink } from "@/presentation/lib/whatsapp";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Luis Barbershop", template: "%s · Luis Barbershop" },
  description: "Cortes, fades y barba. Reserva tu hora en línea.",
};

const navLinks = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#productos", label: "Productos" },
  { href: "/#horario", label: "Horario" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  const contact = getShopContact();
  const whatsappHref = contact.whatsapp && whatsappLink(contact.whatsapp);
  return (
    <html lang="es" className={cn("dark font-sans", sans.variable, display.variable)}>
      <body className="flex min-h-dvh flex-col antialiased">
        <header className={`${container} flex items-center justify-between gap-6 py-4`}>
          <Link href="/" className="inline-flex min-h-11 items-center font-heading text-xl tracking-wide text-primary">
            Luis Barbershop
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hidden min-h-11 items-center px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-primary md:inline-flex"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/reservar"
              className="ml-2 inline-flex min-h-11 items-center rounded-full border border-primary/60 px-5 text-sm text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Reservar
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
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
      </body>
    </html>
  );
}
