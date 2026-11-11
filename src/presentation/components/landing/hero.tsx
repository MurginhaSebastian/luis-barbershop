import Image from "next/image";
import Link from "next/link";
import { HeroVideo } from "./hero-video";
import { container, ctaClass, ghostCtaClass } from "./styles";

/**
 * Portada a pantalla completa: un barbero trabajando en video y, abajo a la izquierda, el nombre y las dos
 * acciones. La foto (la subida en el panel o un fotograma del video) se ve mientras carga o si no se reproduce.
 */
export function Hero({ whatsappHref, image }: { whatsappHref?: string; image?: string }) {
  return (
    // Llena la pantalla bajo la cabecera fija; en el móvil deja sitio también a la barra de "Reservar cita".
    <section className="relative isolate flex min-h-[calc(100svh-8.25rem)] items-end overflow-hidden md:min-h-[calc(100svh-4.75rem)]">
      <Image
        src={image ?? "/videos/corte-escritorio.jpg"}
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="-z-20 object-cover"
      />
      <HeroVideo />
      {/* Caoba desde abajo y desde la izquierda: el texto se lee sobre cualquier fotograma. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background/75 via-background/20 to-transparent" />

      <div className={`${container} pt-28 pb-12 md:pb-16`}>
        <h1 className="font-heading">
          <span className="-ml-[0.05em] block text-[clamp(5rem,20vw,13rem)] leading-[0.8] text-primary">Luis</span>
          <span className="mt-3 block text-[clamp(1.25rem,4vw,2.25rem)] tracking-[0.3em]">Barbershop</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed">
          Cortes a tijera y máquina, fades y afeitado con navaja. Reserva tu hora en un minuto.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/reservar" className={ctaClass}>
            Reservar cita
          </Link>
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={ghostCtaClass}>
              Escríbenos por WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
