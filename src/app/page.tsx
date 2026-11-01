import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { BarberPole } from "@/presentation/components/shop/barber-pole";
import { ServiceMenu } from "@/presentation/components/shop/service-menu";
import { WeeklyHours } from "@/presentation/components/shop/weekly-hours";

const ctaClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

const steps = [
  { title: "Elige servicio y barbero", body: "Puedes combinar varios servicios, por ejemplo corte y barba." },
  { title: "Elige la hora", body: "Solo ves las horas libres, hasta dos semanas por delante." },
  { title: "Te confirmamos por WhatsApp", body: "Pagas en el local, junto con los productos que hayas pedido." },
];

export default function Home() {
  return (
    // pb extra en móvil para que el botón fijo no tape el final.
    <main className="mx-auto max-w-5xl px-4 pb-32 sm:px-6 md:pb-24">
      <section className="grid gap-8 pt-4 pb-16 md:min-h-[70vh] md:grid-cols-[3.5rem_1fr] md:gap-14 md:py-12">
        <BarberPole className="h-9 md:h-auto" />
        <div className="flex flex-col justify-center">
          <h1 className="font-heading">
            <span className="-ml-[0.05em] block text-[clamp(6.5rem,30vw,21rem)] leading-[0.8] text-primary">Luis</span>
            <span className="mt-4 block text-[clamp(1.4rem,6vw,2.75rem)] tracking-[0.3em]">Barbershop</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            Cortes, fades y barba con navaja. Reserva tu hora en un minuto y te confirmamos por WhatsApp.
          </p>
          {/* En móvil ya está el botón fijo de abajo. */}
          <div className="mt-10 hidden md:block">
            <Link href="/reservar" className={ctaClass}>
              Reservar cita
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="como-reservar" className="border-t border-border py-16">
        <h2 id="como-reservar" className="mb-10 font-heading text-4xl">
          Cómo reservar
        </h2>
        <ol className="grid gap-10 md:grid-cols-3">
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

      <Suspense fallback={<p className="border-t border-border py-16 text-muted-foreground">Cargando tarifa y horario…</p>}>
        <ShopInfo />
      </Suspense>

      <section className="border-t border-border py-20 text-center">
        <p className="font-heading text-[clamp(2.25rem,7vw,4rem)] leading-tight">¿Toca corte?</p>
        <Link href="/reservar" className={`${ctaClass} mt-8`}>
          Reservar cita
        </Link>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Link href="/reservar" className={`${ctaClass} w-full`}>
          Reservar cita
        </Link>
      </div>
    </main>
  );
}

async function ShopInfo() {
  await connection();
  const { services, weeklyHours } = await getUseCases().getCatalog.execute();
  return (
    <div className="grid gap-14 border-t border-border py-16 md:grid-cols-[1.5fr_1fr] md:gap-20">
      <section aria-labelledby="tarifa">
        <h2 id="tarifa" className="mb-8 font-heading text-4xl">
          Tarifa
        </h2>
        <ServiceMenu services={services} />
      </section>
      <section aria-labelledby="horario">
        <h2 id="horario" className="mb-8 font-heading text-4xl">
          Horario
        </h2>
        <WeeklyHours weeklyHours={weeklyHours} />
      </section>
    </div>
  );
}
