import type { Metadata } from "next";
import Link from "next/link";
import { container, ctaClass, ghostCtaClass, sectionTitle } from "@/presentation/components/landing/styles";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className={`${container} py-24 text-center`}>
      <h1 className={sectionTitle}>Esta página no existe</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
        Puede que el enlace esté mal escrito o que la página ya no esté disponible.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/reservar" className={ctaClass}>
          Reservar cita
        </Link>
        <Link href="/" className={ghostCtaClass}>
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
