import type { Metadata } from "next";
import { Suspense } from "react";
import { DomainError } from "@/core/errors/domain-errors";
import { bookingWindow, shopDateOf, shopWeekday } from "@/core/scheduling/availability";
import { getUseCases } from "@/infrastructure/container";
import { ConfirmForm } from "@/presentation/components/booking/confirm-form";
import { ScrollIntoView } from "@/presentation/components/booking/scroll-into-view";
import { SlotSearchForm } from "@/presentation/components/booking/slot-search-form";
import { createAppointmentAction } from "./actions";
import { slotQuerySchema } from "./booking-schema";

export const metadata: Metadata = { title: "Reservar cita" };

export default function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <h1 className="mt-6 mb-10 font-heading text-5xl">Reservar cita</h1>
      <Suspense fallback={<p className="min-h-[40rem] text-muted-foreground">Cargando servicios…</p>}>
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
  // Desde la portada se llega con solo ?servicios=…: se marcan, pero aún no se buscan horarios.
  const preselected = slotQuerySchema.shape.servicios.safeParse(params.servicios);
  const searched = "barbero" in params || "dia" in params;

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
          serviceIds: query.success ? query.data.servicios : preselected.success ? preselected.data : [],
          barberId: query.success ? query.data.barbero : undefined,
          date: query.success ? query.data.dia : minDate,
        }}
        minDate={minDate}
        maxDate={shopDateOf(notAfter)}
      />

      {searched && (
        // key: cada búsqueda nueva vuelve a llevar la vista a los resultados.
        <ScrollIntoView
          key={new URLSearchParams(params as Record<string, string>).toString()}
          className="scroll-mt-4 border-t border-border pt-12"
        >
          <div aria-live="polite">
            {problem && <p className="text-destructive">{problem}</p>}
            {!problem && query.success && barber && slots.length === 0 && (
              <p>
                {catalog.weeklyHours[shopWeekday(query.data.dia)]?.length
                  ? `No quedan horarios libres ese día con ${barber.name}. Prueba con otro día u otro barbero.`
                  : "Ese día la barbería está cerrada. Elige otro día."}
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
        </ScrollIntoView>
      )}
    </div>
  );
}
