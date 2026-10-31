import type { Metadata } from "next";
import { Suspense } from "react";
import { DomainError } from "@/core/errors/domain-errors";
import { bookingWindow, shopDateOf } from "@/core/scheduling/availability";
import { getUseCases } from "@/infrastructure/container";
import { ConfirmForm } from "@/presentation/components/booking/confirm-form";
import { SlotSearchForm } from "@/presentation/components/booking/slot-search-form";
import { createAppointmentAction } from "./actions";
import { slotQuerySchema } from "./booking-schema";

export const metadata: Metadata = { title: "Reservar cita" };

export default function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <h1 className="mt-6 mb-10 font-heading text-5xl">Reservar cita</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando servicios…</p>}>
        <Booking searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Booking({ searchParams }: Pick<PageProps<"/reservar">, "searchParams">) {
  const params = await searchParams;
  const { getCatalog, getAvailableSlots } = getUseCases();
  const catalog = await getCatalog.execute();

  const { notBefore, notAfter } = bookingWindow(new Date());
  const minDate = shopDateOf(notBefore);
  const query = slotQuerySchema.safeParse(params);
  const searched = Object.keys(params).length > 0;

  let slots: string[] = [];
  let problem = searched && !query.success ? "Elige al menos un servicio, un barbero y un día." : "";
  if (query.success) {
    try {
      const found = await getAvailableSlots.execute({
        barberId: query.data.barbero,
        serviceIds: query.data.servicios,
        date: query.data.dia,
      });
      slots = found.map((s) => s.start.toISOString());
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      problem = error.message;
    }
  }

  const barber = query.success ? catalog.barbers.find((b) => b.id === query.data.barbero) : undefined;
  const services = query.success ? catalog.services.filter((s) => query.data.servicios.includes(s.id)) : [];

  return (
    <div className="space-y-12">
      <SlotSearchForm
        services={catalog.services}
        barbers={catalog.barbers}
        selected={{
          serviceIds: query.success ? query.data.servicios : [],
          barberId: query.success ? query.data.barbero : undefined,
          date: query.success ? query.data.dia : minDate,
        }}
        minDate={minDate}
        maxDate={shopDateOf(notAfter)}
      />

      <div aria-live="polite" className="border-t border-border pt-12">
        {problem && <p className="text-destructive">{problem}</p>}
        {!problem && query.success && barber && slots.length === 0 && (
          <p>
            No quedan horarios libres ese día con {barber.name}. Prueba con otro día u otro barbero.
          </p>
        )}
        {!problem && barber && slots.length > 0 && (
          // key: al cambiar la búsqueda, el formulario empieza de cero.
          <ConfirmForm
            key={`${query.data?.barbero}-${query.data?.dia}-${services.map((s) => s.id).join()}`}
            action={createAppointmentAction}
            barber={barber}
            services={services}
            products={catalog.products}
            slots={slots}
          />
        )}
      </div>
    </div>
  );
}
