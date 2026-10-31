import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getUseCases } from "@/infrastructure/container";
import { ServiceMenu } from "@/presentation/components/shop/service-menu";
import { WeeklyHours } from "@/presentation/components/shop/weekly-hours";

const ctaClass =
  "inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <section className="py-12 text-center sm:py-20">
        {/* Doble filete como el rótulo dorado de una vitrina. */}
        <div className="mx-auto max-w-2xl rounded-[2.25rem] border-2 border-primary/70 p-1.5">
          <div className="rounded-[1.85rem] border border-primary/35 px-6 py-12 sm:py-16">
            <h1 className="font-heading text-primary">
              <span className="block text-7xl leading-none sm:text-9xl">Luis</span>
              <span className="mt-4 block text-2xl tracking-[0.25em] text-foreground sm:text-4xl">Barbershop</span>
            </h1>
            <p className="mt-6 text-muted-foreground">Cortes, fades y barba con navaja.</p>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-md text-lg">
          Elige tu servicio, tu barbero y la hora que te venga mejor. Te confirmamos por WhatsApp.
        </p>
        <Link href="/reservar" className={`${ctaClass} mt-8`}>
          Reservar cita
        </Link>
      </section>

      <Suspense fallback={<p className="text-muted-foreground">Cargando servicios y horario…</p>}>
        <ShopInfo />
      </Suspense>
    </main>
  );
}

async function ShopInfo() {
  await connection();
  const { services, weeklyHours } = await getUseCases().getCatalog.execute();
  return (
    <div className="grid gap-14 border-t border-border pt-14 md:grid-cols-[1.5fr_1fr] md:gap-20">
      <section aria-labelledby="servicios">
        <h2 id="servicios" className="mb-8 font-heading text-4xl">
          Servicios
        </h2>
        <ServiceMenu services={services} />
      </section>
      <section aria-labelledby="horario">
        <h2 id="horario" className="mb-8 font-heading text-4xl">
          Horario
        </h2>
        <WeeklyHours weeklyHours={weeklyHours} />
        <Link href="/reservar" className={`${ctaClass} mt-10`}>
          Reservar cita
        </Link>
      </section>
    </div>
  );
}
