import { Flower2, MessageCircle, type LucideIcon, Scissors, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroVideo } from "./hero-video";
import { container, darkGhostBtn, eyebrowDark, goldBtn } from "./styles";

/**
 * Portada 16:9 con el video entero, sin recortarlo (en el móvil el texto va bajo el video). La foto (la subida en el
 * panel o un fotograma del video) se ve mientras carga o si no se reproduce. Sin animaciones de entrada: es el LCP.
 * Debajo, la franja de ventajas (texto de marca, no datos).
 */
export function Hero({ assistantHref, image }: { assistantHref?: string; image?: string }) {
  const perks: { label: string; Icon: LucideIcon }[] = [
    { label: "Barberos expertos", Icon: Scissors },
    { label: assistantHref ? "Reserva por WhatsApp" : "Reserva en línea", Icon: MessageCircle },
    { label: "Sin crear cuenta", Icon: Zap },
    { label: "Barbería y Spa", Icon: Flower2 },
  ];
  return (
    <>
      {/* En el móvil, columna invertida: el video arriba y el texto debajo, pero el texto sigue antes en el DOM. */}
      <section className="relative isolate flex flex-col-reverse overflow-hidden bg-dark-canvas text-on-dark-canvas md:aspect-video md:flex-row md:items-center">
        <div className={`${container} py-8 md:relative md:z-10 md:py-0`}>
          <p className={eyebrowDark}>Estilo clásico · Trujillo</p>
          <h1 className="mt-3 font-headline">
            <span className="-ml-[0.05em] block text-[clamp(3.5rem,19vw,5.5rem)] leading-[0.85] font-bold text-gold md:text-[min(8vw,8rem)]">D&apos;luiss</span>
            <span className="mt-3 block text-[clamp(1rem,4vw,1.5rem)] tracking-[0.3em] uppercase md:text-[min(2.2vw,2rem)]">Barber Shop</span>
          </h1>
          <p className="mt-4 max-w-md font-body text-body-lg text-dark-muted md:text-[min(1.5vw,1.125rem)]">
            Cortes de precisión, fades limpios y reserva en un minuto, sin crear cuenta.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {assistantHref ? (
              <a href={assistantHref} target="_blank" rel="noopener noreferrer" className={goldBtn}>
                <MessageCircle aria-hidden className="size-5" />
                Reservar por WhatsApp
              </a>
            ) : (
              <Link href="/reservar" className={goldBtn}>
                Reservar cita
              </Link>
            )}
            <a href="#servicios" className={darkGhostBtn}>
              Ver servicios
            </a>
          </div>
        </div>
        {/* Después del texto: el teclado y el lector de pantalla llegan antes al nombre que al botón de pausa. */}
        <div className="relative aspect-video w-full md:absolute md:inset-0 md:aspect-auto">
          <Image src={image ?? "/videos/portadas.jpg"} alt="" fill sizes="100vw" loading="eager" fetchPriority="high" className="-z-20 object-cover" />
          {/* Negro carbón desde la izquierda: el texto se lee sobre cualquier fotograma. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-dark-canvas via-dark-canvas/45 to-transparent max-md:from-dark-canvas/10 max-md:via-transparent" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-dark-canvas/70 via-transparent to-transparent max-md:hidden" />
          <HeroVideo />
        </div>
      </section>
      <section aria-label="Ventajas" className="border-y border-gold/40 bg-dark-elevated text-on-dark-elevated">
        <ul className={`${container} grid grid-cols-1 gap-gutter-md py-6 min-[480px]:grid-cols-2 lg:grid-cols-4`}>
          {perks.map(({ label, Icon }) => (
            <li key={label} className="flex items-center gap-gutter-md lg:justify-center">
              <Icon aria-hidden className="size-6 shrink-0 text-gold" />
              <span className="font-title text-title-md">{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
