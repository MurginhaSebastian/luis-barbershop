import { Clock, HeartHandshake, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";
import { spaIconFor } from "@/presentation/lib/spa-icon";
import { BookLink } from "./book-link";
import { container, ghostCtaClass, sectionTitle } from "./styles";

const seals = [
  { label: "Ambiente relajante", Icon: Leaf },
  { label: "Atención personalizada", Icon: HeartHandshake },
  { label: "Productos de calidad", Icon: Sparkles },
  { label: "Higiene y seguridad", Icon: ShieldCheck },
];

const circle = "grid size-12 shrink-0 place-items-center rounded-full border border-rose/50 text-rose";

/** Área de mujeres: Dluiss Spa & Beauty. Cada servicio abre la reserva con ese servicio marcado. */
export function ParaEllas({
  services,
  assistant,
  whatsappHref,
}: {
  services: Service[];
  assistant?: string | null;
  whatsappHref?: string;
}) {
  return (
    <section id="para-ellas" aria-labelledby="para-ellas-t" className="scroll-mt-6 border-y border-rose/20 bg-card">
      <div className={`${container} py-20`}>
        <p className="text-sm font-semibold tracking-[0.3em] text-rose uppercase">Dluiss Spa &amp; Beauty</p>
        <h2 id="para-ellas-t" className={`${sectionTitle} mt-3`}>
          Para ellas
        </h2>
        <p className="mt-3 font-heading text-xl text-rose italic">Para ti, que mereces sentirte única y hermosa</p>
        <p className="mt-4 max-w-prose leading-relaxed text-muted-foreground">
          Un espacio creado para realzar tu belleza, cuidar de ti y darte el momento de bienestar que mereces.
        </p>

        {services.length === 0 && (
          <div className="mt-10">
            <p className="max-w-prose text-muted-foreground">
              Estamos preparando nuestra carta de servicios. Escríbenos y te contamos todo lo que tenemos para ti.
            </p>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={`${ghostCtaClass} mt-6`}>
                Consúltanos por WhatsApp
              </a>
            )}
          </div>
        )}

        {services.length > 0 && <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.toSorted((a, b) => b.priceCents - a.priceCents).map((s) => {
            const Icon = spaIconFor(s.name);
            return (
              <li key={s.id}>
                <BookLink
                  assistant={assistant}
                  text={`Hola, quiero reservar: ${s.name}`}
                  webHref={`/reservar?servicios=${s.id}`}
                  className="flex min-h-20 cursor-pointer items-center gap-4 rounded-2xl border border-rose/30 p-4 transition-colors duration-200 hover:border-rose focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose"
                >
                  <span aria-hidden className={circle}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-heading text-xl">{s.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                      <Clock aria-hidden className="size-3.5" />
                      {s.durationMinutes} min · <span className="text-rose">{formatPrice(s.priceCents)}</span>
                    </span>
                  </span>
                </BookLink>
              </li>
            );
          })}
        </ul>}

        <ul className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {seals.map(({ label, Icon }) => (
            <li key={label} className="flex flex-col items-center gap-3 text-center text-sm">
              <span aria-hidden className={circle}>
                <Icon className="size-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-12 text-center font-heading text-2xl text-rose italic">Porque mereces tu mejor versión, siempre</p>
      </div>
    </section>
  );
}
