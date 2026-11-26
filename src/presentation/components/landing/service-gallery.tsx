import { Baby, Crown, Eye, type LucideIcon, Scissors, Sparkles } from "lucide-react";
import Image from "next/image";
import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";
import { BookLink } from "./book-link";
import { Reveal } from "./reveal";
import { darkBtn } from "./styles";

const PHOTOS: [RegExp, string][] = [
  [/barba/i, "/images/barba.jpg"],
  [/navaja|afeit|ceja/i, "/images/navaja.jpg"],
  [/fade|degrad|máquina/i, "/images/maquina.jpg"],
  [/corte/i, "/images/tijeras.jpg"],
];

const ICONS: [RegExp, LucideIcon][] = [
  [/ceja/i, Eye],
  [/barba|afeit|navaja/i, Sparkles],
  [/ni[ñn]o/i, Baby],
  [/vip|premium|completo/i, Crown],
];

// Sin foto propia subida desde el panel, una de ejemplo elegida por el nombre del servicio.
export function photoFor(service: Pick<Service, "name">) {
  return PHOTOS.find(([pattern]) => pattern.test(service.name))?.[1] ?? "/images/hero.jpg";
}

const iconFor = (name: string): LucideIcon => ICONS.find(([p]) => p.test(name))?.[1] ?? Scissors;

/** Tarjetas de servicios con foto; el botón abre la reserva con ese servicio ya marcado. */
export function ServiceGallery({ services, assistant }: { services: Service[]; assistant?: string | null }) {
  if (services.length === 0) return <p className="text-light-muted">Pronto publicaremos nuestros servicios.</p>;
  return (
    <ul className="grid gap-gutter-lg sm:grid-cols-2 lg:grid-cols-4">
      {services.toSorted((a, b) => b.priceCents - a.priceCents).map((s, i) => {
        const Icon = iconFor(s.name);
        return (
          <li key={s.id}>
            <Reveal delay={Math.min(i, 3) * 0.08} className="h-full">
              <article className="flex h-full flex-col overflow-hidden rounded-md border border-light-outline bg-light-card text-on-light-card shadow-sm">
                <div className="relative h-48 bg-dark-elevated">
                  <Image
                    src={s.imageUrl ?? photoFor(s)}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="relative flex flex-1 flex-col items-center gap-gutter-xs px-gutter-md pt-8 pb-gutter-lg text-center">
                  <span aria-hidden className="absolute -top-6 left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full border-2 border-gold bg-dark-canvas text-gold">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-title text-title-lg">{s.name}</h3>
                  <p className="font-body text-body-md text-light-muted tabular-nums">
                    {s.durationMinutes} min · {formatPrice(s.priceCents)}
                  </p>
                  <BookLink
                    assistant={assistant}
                    text={`Hola, quiero reservar un ${s.name}`}
                    webHref={`/reservar?servicios=${s.id}`}
                    className={`${darkBtn} mt-auto w-full`}
                  >
                    Reservar<span className="sr-only"> este servicio: {s.name}</span>
                  </BookLink>
                </div>
              </article>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
