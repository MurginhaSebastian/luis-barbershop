import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/core/entities/catalog";
import type { BusinessHours } from "@/core/scheduling/availability";
import { WeeklyHours } from "@/presentation/components/shop/weekly-hours";
import { formatPrice } from "@/presentation/lib/format";
import { container, ctaClass, sectionTitle } from "./styles";

export function About() {
  return (
    <section id="nosotros" aria-labelledby="nosotros-t" className={`${container} grid scroll-mt-6 items-center gap-10 py-20 md:grid-cols-2 md:gap-16`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-border">
        <Image src="/images/sillon.jpg" alt="Sillones de barbero frente a los espejos" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </div>
      <div>
        <h2 id="nosotros-t" className={sectionTitle}>
          Oficio de barbería, sin apuro
        </h2>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
          En Luis Barbershop cortamos como se aprende en la barbería: escuchando lo que quieres, con tijera,
          máquina y navaja, y tomándonos el tiempo que pide cada corte.
        </p>
        <p className="mt-4 max-w-prose leading-relaxed text-muted-foreground">
          Reservas en línea, eliges a tu barbero y llegas a la hora. Así de simple.
        </p>
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
    <section aria-labelledby="porque-t" className="border-y border-border bg-card">
      <div className={`${container} py-20`}>
        <h2 id="porque-t" className={sectionTitle}>
          Por qué venir
        </h2>
        <dl className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r) => (
            <div key={r.title} className="border-t-2 border-primary pt-5">
              <dt className="text-lg font-semibold">{r.title}</dt>
              <dd className="mt-2 leading-relaxed text-muted-foreground">{r.body}</dd>
            </div>
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

export function HowToBook() {
  return (
    <section aria-labelledby="como-t" className={`${container} py-20`}>
      <h2 id="como-t" className={sectionTitle}>
        Cómo reservar
      </h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span aria-hidden className="font-heading text-7xl leading-none text-primary">
              {i + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-1 leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Products({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section id="productos" aria-labelledby="productos-t" className="scroll-mt-6 border-y border-border bg-card">
      <div className={`${container} grid items-center gap-10 py-20 md:grid-cols-[1fr_1.1fr] md:gap-16`}>
        <div>
          <h2 id="productos-t" className={sectionTitle}>
            Para llevar a casa
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Lo añades al reservar, te lo tenemos listo y lo pagas en tu cita.
          </p>
          <ul className="mt-8 space-y-4">
            {products.map((p) => (
              <li key={p.id} className="flex items-baseline gap-3">
                <span className="font-heading text-xl">{p.name}</span>
                <span aria-hidden className="flex-1 -translate-y-1 border-b border-dotted border-primary/40" />
                <span className="tabular-nums text-primary">{formatPrice(p.priceCents)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-border">
          <Image src="/images/herramientas.jpg" alt="Máquinas, tijeras, peine y productos de barbería" fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
        </div>
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
    <section aria-labelledby="opiniones-t" className={`${container} py-20`}>
      <h2 id="opiniones-t" className={sectionTitle}>
        Lo que dicen
      </h2>
      <ul className="mt-12 grid gap-8 md:grid-cols-3">
        {items.map((t) => (
          <li key={t.name}>
            <figure>
              <blockquote className="font-heading text-2xl leading-snug">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-muted-foreground">{t.name}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VisitUs({
  weeklyHours,
  address,
  mapsUrl,
}: {
  weeklyHours: BusinessHours[][];
  address?: string;
  mapsUrl?: string;
}) {
  return (
    <section id="horario" aria-labelledby="horario-t" className={`${container} grid scroll-mt-6 gap-12 py-20 md:grid-cols-2`}>
      <div>
        <h2 id="horario-t" className={sectionTitle}>
          Horario
        </h2>
        <div className="mt-8">
          <WeeklyHours weeklyHours={weeklyHours} />
        </div>
      </div>
      {address && (
        <div>
          <h2 className={sectionTitle}>Dónde estamos</h2>
          <p className="mt-8 text-lg">{address}</p>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center text-primary underline underline-offset-4"
            >
              Cómo llegar en Google Maps
            </a>
          )}
        </div>
      )}
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image src="/images/tijeras.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-background/80" />
      <div className={`${container} py-24 text-center`}>
        <p className="font-heading text-[clamp(2.5rem,8vw,5rem)] leading-tight">¿Toca corte?</p>
        <p className="mx-auto mt-4 max-w-md text-lg">Elige tu hora y te esperamos.</p>
        <Link href="/reservar" className={`${ctaClass} mt-8`}>
          Reservar cita
        </Link>
      </div>
    </section>
  );
}
