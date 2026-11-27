import Image from "next/image";
import { Clock, HeartHandshake, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";
import { spaIconFor } from "@/presentation/lib/spa-icon";
import { BookLink } from "./book-link";
import { Reveal } from "./reveal";
import { container, spaBtn } from "./styles";

const seals = [
  { label: "Ambiente relajante", Icon: Leaf },
  { label: "Atención personalizada", Icon: HeartHandshake },
  { label: "Productos de calidad", Icon: Sparkles },
  { label: "Higiene y seguridad", Icon: ShieldCheck },
];

const circle = "grid size-11 shrink-0 place-items-center rounded-full border border-spa-primary/50 text-spa-primary";

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
    <section id="para-ellas" aria-labelledby="para-ellas-t" className="scroll-mt-6 border-y border-spa-outline bg-spa-surface text-on-spa-surface">
      <div className={`${container} py-section-sm lg:py-section-lg`}>
        <div className="grid items-center gap-gutter-xl lg:grid-cols-[1.1fr_1fr]">
        <div>
        <Reveal>
          <p className="font-spa text-lg font-semibold uppercase tracking-[0.3em] text-spa-primary">Dluiss Spa &amp; Beauty</p>
          <h2 id="para-ellas-t" className="mt-2 font-spa text-5xl font-semibold italic md:text-7xl">
            Para ellas
          </h2>
          <p className="mt-2 font-spa-script text-4xl text-spa-primary md:text-5xl">Para ti, que mereces sentirte única y hermosa</p>
          <p className="mt-3 max-w-prose font-body text-body-lg text-spa-muted">
            Un espacio creado para realzar tu belleza, cuidar de ti y darte el momento de bienestar que mereces.
          </p>
        </Reveal>

        {services.length === 0 && (
          <div className="mt-8">
            <p className="max-w-prose text-spa-muted">
              Estamos preparando nuestra carta de servicios. Escríbenos y te contamos todo lo que tenemos para ti.
            </p>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={`${spaBtn} mt-6`}>
                Consúltanos por WhatsApp
              </a>
            )}
          </div>
        )}

        {services.length > 0 && (
          <>
            <ul className="mt-8 grid gap-gutter-md sm:grid-cols-2">
              {services.toSorted((a, b) => b.priceCents - a.priceCents).map((s) => {
                const Icon = spaIconFor(s.name);
                return (
                  <li key={s.id}>
                    <Reveal className="h-full">
                      <BookLink
                        assistant={assistant}
                        text={`Hola, quiero reservar: ${s.name}`}
                        webHref={`/reservar?servicios=${s.id}`}
                        className="flex h-full min-h-20 cursor-pointer items-center gap-gutter-md rounded-md border border-spa-outline bg-white/60 p-gutter-md transition-colors duration-150 hover:border-spa-primary hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-spa-primary"
                      >
                        <span aria-hidden className={circle}>
                          <Icon className="size-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-spa text-xl font-semibold leading-tight">{s.name}</span>
                          <span className="flex items-center gap-1 font-body text-body-md text-spa-muted tabular-nums">
                            <Clock aria-hidden className="size-3.5" />
                            {s.durationMinutes} min · {formatPrice(s.priceCents)}
                          </span>
                        </span>
                      </BookLink>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
            <BookLink
              assistant={assistant}
              text="Hola, quiero reservar en el área de Spa"
              webHref="/reservar"
              className={`${spaBtn} mt-8`}
            >
              Reservar en Spa
            </BookLink>
          </>
        )}

        </div>
        <Reveal className="order-first lg:order-none">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-none [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent),linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] [-webkit-mask-composite:source-in]">
              <Image src="/images/para-ellas.webp" alt="Estilista aplicando extensiones de pestañas a una clienta en el salón" fill loading="lazy" sizes="(min-width: 1024px) 45vw, (min-width: 384px) 384px, 100vw" className="object-cover object-[50%_45%]" />
            </div>
        </Reveal>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-gutter-lg border-t border-spa-outline pt-8 lg:grid-cols-4">
          {seals.map(({ label, Icon }) => (
            <li key={label} className="flex flex-col items-center gap-3 text-center font-body text-body-md text-spa-muted">
              <span aria-hidden className={circle}>
                <Icon className="size-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center font-spa text-2xl font-medium italic text-spa-primary md:text-3xl">
          Porque mereces tu mejor versión, siempre
        </p>
      </div>
    </section>
  );
}
