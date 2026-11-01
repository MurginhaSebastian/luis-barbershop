import type { Metadata } from "next";
import "./globals.css";
import { Bodoni_Moda, Manrope } from "next/font/google";
import Link from "next/link";
import { cn } from "@/presentation/lib/utils";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Luis Barbershop", template: "%s · Luis Barbershop" },
  description: "Cortes, fades y barba. Reserva tu hora en línea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("dark font-sans", sans.variable, display.variable)}>
      <body className="min-h-dvh antialiased">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-heading text-xl tracking-wide text-primary">
            Luis Barbershop
          </Link>
          <Link
            href="/reservar"
            className="inline-flex min-h-11 items-center rounded-full border border-primary/60 px-5 text-sm text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Reservar
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
