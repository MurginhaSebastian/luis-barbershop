import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroVideo } from "./hero-video";
import { container, ctaClass, ghostCtaClass } from "./styles";

/**
 * Portada con la proporción del video (9:16 en el móvil vertical, 16:9 en el resto), sin recortarlo: un barbero trabajando en video y, abajo a la izquierda, el nombre y las dos
 * acciones. La foto (la subida en el panel o un fotograma del video) se ve mientras carga o si no se reproduce.
 */
export function Hero({ whatsappHref, assistantHref, image }: { whatsappHref?: string; assistantHref?: string; image?: string }) {
  return (
    // La misma condición que la <source media> de HeroVideo: así el object-cover del video no recorta nada.
    <section className="relative isolate flex aspect-video items-end overflow-hidden max-md:portrait:aspect-[9/16]">
      <Image
        src={image ?? "/videos/corte-escritorio.jpg"}
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="-z-20 object-cover"
      />
      {/* Caoba desde abajo y desde la izquierda: el texto se lee sobre cualquier fotograma. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background/75 via-background/20 to-transparent" />

      <div className={`${container} pb-6 md:pb-[3vw]`}>
        <h1 className="font-heading">
          <span className="-ml-[0.05em] block text-[clamp(4rem,20vw,6rem)] md:text-[9vw] xl:text-[min(9vw,10rem)] leading-[0.8] text-primary">D&apos;luiss</span>
          <span className="mt-3 block text-[clamp(1rem,4vw,1.5rem)] md:text-[min(2.4vw,2.25rem)] tracking-[0.3em]">Barber Shop</span>
        </h1>
        <p className="mt-3 max-w-md text-sm md:mt-[1.5vw] md:text-[min(1.6vw,1.125rem)] leading-relaxed">
          Cortes a tijera y máquina, fades y afeitado con navaja. Reserva tu hora en un minuto.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 md:mt-[2vw]">
          {assistantHref ? (
            <a href={assistantHref} target="_blank" rel="noopener noreferrer" className={`${ctaClass} gap-2`}>
              <MessageCircle aria-hidden className="size-5" />
              Reservar por WhatsApp
            </a>
          ) : (
            <>
              <Link href="/reservar" className={ctaClass}>
                Reservar cita
              </Link>
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={ghostCtaClass}>
                  Escríbenos por WhatsApp
                </a>
              )}
            </>
          )}
        </div>
      </div>
      {/* Después del texto: el teclado y el lector de pantalla llegan antes al nombre que al botón de pausa. */}
      <HeroVideo />
    </section>
  );
}
