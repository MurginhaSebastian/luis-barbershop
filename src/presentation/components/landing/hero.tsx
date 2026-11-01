import Image from "next/image";
import Link from "next/link";
import { BarberPole } from "@/presentation/components/shop/barber-pole";
import { container, ctaClass, ghostCtaClass } from "./styles";

/** Portada a todo el ancho: foto oscurecida con la paleta de la casa y el nombre encima. */
export function Hero({ whatsappHref }: { whatsappHref?: string }) {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="-z-10 object-cover object-[70%_30%]"
      />
      {/* Degradado caoba: asegura contraste del texto sobre cualquier foto. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-background" />

      <div className={`${container} grid gap-8 py-14 md:min-h-[78vh] md:grid-cols-[3rem_1fr] md:gap-12 md:py-20`}>
        <BarberPole className="h-8 md:h-auto" />
        <div className="flex max-w-2xl flex-col justify-center">
          <h1 className="font-heading">
            <span className="-ml-[0.05em] block text-[clamp(6rem,26vw,17rem)] leading-[0.8] text-primary">Luis</span>
            <span className="mt-4 block text-[clamp(1.4rem,5vw,2.5rem)] tracking-[0.3em]">Barbershop</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed">
            Cortes a tijera y máquina, fades y afeitado con navaja. Reserva tu hora en un minuto.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
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
      </div>
    </section>
  );
}
