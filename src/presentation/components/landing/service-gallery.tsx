import Image from "next/image";
import Link from "next/link";
import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";

const PHOTOS: [RegExp, string][] = [
  [/barba/i, "/images/barba.jpg"],
  [/navaja|afeit|ceja/i, "/images/navaja.jpg"],
  [/fade|degrad|máquina/i, "/images/maquina.jpg"],
  [/corte/i, "/images/tijeras.jpg"],
];

// Sin foto propia subida desde el panel, una de ejemplo elegida por el nombre del servicio.
function photoFor(service: Service) {
  return PHOTOS.find(([pattern]) => pattern.test(service.name))?.[1] ?? "/images/hero.jpg";
}

/** Mosaico de servicios con foto; cada uno abre la reserva con ese servicio ya marcado. */
export function ServiceGallery({ services }: { services: Service[] }) {
  if (services.length === 0) return <p className="text-muted-foreground">Pronto publicaremos nuestros servicios.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {services.toSorted((a, b) => b.priceCents - a.priceCents).map((s) => (
        <li key={s.id}>
          <Link
            href={`/reservar?servicios=${s.id}`}
            className="group relative flex aspect-[4/5] cursor-pointer flex-col justify-end overflow-hidden rounded-2xl ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <Image
              src={s.imageUrl ?? photoFor(s)}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="-z-10 object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="p-5">
              <h3 className="font-heading text-2xl">{s.name}</h3>
              <p className="mt-1 text-sm tabular-nums">
                <span className="text-primary">{formatPrice(s.priceCents)}</span>
                <span className="text-muted-foreground"> · {s.durationMinutes} min</span>
              </p>
              <span className="mt-3 inline-block text-sm text-primary underline-offset-4 group-hover:underline">
                Reservar este servicio
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
