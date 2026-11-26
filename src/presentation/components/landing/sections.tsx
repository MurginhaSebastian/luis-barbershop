import { SHOP_NAME } from "@/core/entities/site";
import { MapPin } from "lucide-react";
import Image from "next/image";
import type { Product } from "@/core/entities/catalog";
import type { BusinessHours } from "@/core/scheduling/availability";
import { WeeklyHours } from "@/presentation/components/shop/weekly-hours";
import { formatPrice } from "@/presentation/lib/format";
import { BookLink } from "./book-link";
import { Reveal } from "./reveal";
import { container, eyebrowDark, eyebrowLight, goldBtn, h2Light } from "./styles";

const pad = `${container} py-section-sm lg:py-section-lg`;

/** `image`: foto subida desde el panel; sin ella, la de ejemplo. Igual en Products y ClosingCta. */
export function About({ image }: { image?: string }) {
  return (
    <section id="nosotros" aria-labelledby="nosotros-t" className="scroll-mt-6 bg-light-canvas text-on-light-canvas">
      <div className={`${pad} grid items-center gap-10 md:grid-cols-2 md:gap-16`}>
        <Reveal className="relative aspect-[4/3] overflow-hidden rounded-md border border-light-outline">
          <Image src={image ?? "/images/sillon.jpg"} alt="La barbería por dentro" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </Reveal>
        <Reveal>
          <p className={eyebrowLight}>Nosotros</p>
          <h2 id="nosotros-t" className={`${h2Light} mt-2`}>
            Oficio de barbería, sin apuro
          </h2>
          <p className="mt-6 max-w-prose font-body text-body-lg text-light-muted">
            En {SHOP_NAME} cortamos como se aprende en la barbería: escuchando lo que quieres, con tijera,
            máquina y navaja, y tomándonos el tiempo que pide cada corte.
          </p>
          <p className="mt-4 max-w-prose font-body text-body-lg text-light-muted">
            Reservas en línea, eliges a tu barbero y llegas a la hora. Así de simple.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const reasons = [
  { title: "Tu hora es tuya", body: "Reservas en línea y te atendemos a la hora acordada, sin colas." },
  { title: "Eliges a tu barbero", body: "Repite con quien ya conoce tu corte o prueba con otro del equipo." },
  { title: "Acabado a navaja", body: "Perfilamos con navaja para que el corte se vea limpio más días." },
  { title: "Productos para casa", body: "Ceras y aceites para mantener el corte; los pides al reservar." },
];

export function WhyUs() {
  return (
    <section aria-labelledby="porque-t" className="border-y border-dark-outline bg-dark-elevated text-on-dark-elevated">
      <div className={pad}>
        <Reveal>
          <h2 id="porque-t" className="font-headline text-headline-lg-mobile md:text-headline-lg">
            Por qué venir
          </h2>
        </Reveal>
        <dl className="mt-10 grid gap-gutter-xl sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08} className="border-t-2 border-gold pt-5">
              <dt className="font-title text-title-lg">{r.title}</dt>
              <dd className="mt-2 font-body text-body-md text-dark-muted">{r.body}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

const steps = [
  { title: "Elige servicio y barbero", body: "Puedes combinar varios servicios, por ejemplo corte y barba." },
  { title: "Elige la hora", body: "Solo ves las horas libres, hasta dos semanas por delante." },
  { title: "Te confirmamos por WhatsApp", body: "Pagas en el local, junto con los productos que hayas pedido." },
];

const whatsappSteps = [
  { title: "Escríbenos por WhatsApp", body: "Dile al asistente qué servicio quieres." },
  { title: "Elige entre horas libres", body: "El asistente te ofrece las horas disponibles y te reserva." },
  { title: "Te lo recordamos", body: "Te avisamos 35 minutos antes; pagas en el local." },
];

/** Tres pasos y, si hay dirección, la tarjeta de ubicación (`#ubicacion`) en la misma franja oscura. */
export function HowToBook({ assistant, address, mapsUrl }: { assistant?: string | null; address?: string; mapsUrl?: string }) {
  const list = assistant ? whatsappSteps : steps;
  return (
    <section id="como-reservar" aria-labelledby="como-t" className="scroll-mt-6 bg-dark-canvas text-on-dark-canvas">
      <div className={pad}>
        <Reveal>
          <h2 id="como-t" className="font-headline text-headline-lg-mobile md:text-headline-lg">
            Cómo reservar
          </h2>
        </Reveal>
        <div className={`mt-8 grid gap-gutter-lg ${address ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
          <ol className="grid gap-gutter-md md:grid-cols-3">
            {list.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={i * 0.08} className="h-full rounded-md border border-dark-outline bg-dark-elevated p-gutter-lg">
                  <span aria-hidden className="grid size-8 place-items-center rounded-full bg-gold font-title text-title-md text-on-gold">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-title text-title-md">{step.title}</h3>
                  <p className="mt-1 font-body text-body-md text-dark-muted">{step.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
          {address && (
            <Reveal delay={0.24} className="flex flex-col justify-between gap-gutter-md rounded-md border border-dark-outline bg-dark-elevated p-gutter-lg">
              <div id="ubicacion" className="flex scroll-mt-24 items-start gap-gutter-md">
                <MapPin aria-hidden className="mt-1 size-6 shrink-0 text-gold" />
                <div>
                  <h3 className="font-title text-title-lg">Ubicación</h3>
                  <p className="mt-1 font-body text-body-md text-dark-muted">{address}</p>
                </div>
              </div>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={goldBtn}>
                  Ver en el mapa
                </a>
              )}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

export function Products({ products, image }: { products: Product[]; image?: string }) {
  if (products.length === 0) return null;
  return (
    <section id="productos" aria-labelledby="productos-t" className="scroll-mt-6 bg-light-canvas text-on-light-canvas">
      <div className={`${pad} grid items-center gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16`}>
        <Reveal>
          <p className={eyebrowLight}>Productos</p>
          <h2 id="productos-t" className={`${h2Light} mt-2`}>
            Para llevar a casa
          </h2>
          <p className="mt-4 max-w-md font-body text-body-lg text-light-muted">
            Lo añades al reservar, te lo tenemos listo y lo pagas en tu cita.
          </p>
          <ul className="mt-8 space-y-4">
            {products.map((p) => (
              <li key={p.id} className="flex items-baseline gap-3">
                <span className="font-title text-title-md">{p.name}</span>
                <span aria-hidden className="flex-1 -translate-y-1 border-b border-dotted border-gold-on-light/50" />
                <span className="font-title text-title-md text-gold-on-light tabular-nums">{formatPrice(p.priceCents)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="relative aspect-[4/3] overflow-hidden rounded-md border border-light-outline">
          <Image src={image ?? "/images/herramientas.jpg"} alt="Productos de la barbería" fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
        </Reveal>
      </div>
    </section>
  );
}

export interface Testimonial {
  quote: string;
  name: string;
}

/** Solo se muestra con opiniones reales de clientes (ver presentation/content/testimonials.ts). */
export function Testimonials({ items }: { items: readonly Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="opiniones-t" className="bg-light-canvas text-on-light-canvas">
      <div className={pad}>
        <h2 id="opiniones-t" className={h2Light}>
          Lo que dicen
        </h2>
        <ul className="mt-10 grid gap-gutter-xl md:grid-cols-3">
          {items.map((t) => (
            <li key={t.name}>
              <Reveal>
                <figure className="rounded-md border border-light-outline bg-light-card p-gutter-lg">
                  <blockquote className="font-headline text-title-lg">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 font-body text-body-md text-light-muted">{t.name}</figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function VisitUs({ weeklyHours }: { weeklyHours: BusinessHours[][] }) {
  return (
    <section id="horario" aria-labelledby="horario-t" className="scroll-mt-6 border-t border-dark-outline bg-dark-canvas text-on-dark-canvas">
      <div className={pad}>
        <Reveal>
          <p className={eyebrowDark}>Visítanos</p>
          <h2 id="horario-t" className="mt-2 font-headline text-headline-lg-mobile md:text-headline-lg">
            Horario
          </h2>
          <div className="mt-8">
            <WeeklyHours weeklyHours={weeklyHours} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ClosingCta({ image, assistant }: { image?: string; assistant?: string | null }) {
  return (
    <section className="relative isolate overflow-hidden bg-dark-canvas text-on-dark-canvas">
      <Image src={image ?? "/images/tijeras.jpg"} alt="" fill sizes="100vw" className="-z-10 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-dark-canvas/85" />
      <div className={`${container} py-24 text-center`}>
        <Reveal>
          <p className="font-headline text-[clamp(2.25rem,8vw,4.5rem)] leading-tight font-bold">¿Toca corte?</p>
          <p className="mx-auto mt-4 max-w-md font-body text-body-lg text-on-dark-canvas">Elige tu hora y te esperamos.</p>
          <BookLink assistant={assistant} className={`${goldBtn} mt-8`}>
            Reservar cita
          </BookLink>
        </Reveal>
      </div>
    </section>
  );
}
