import type { Metadata } from "next";
import { Suspense } from "react";
import { bookingWindow, shopDateOf, shopWeekday } from "@/core/scheduling/availability";
import { getUseCases } from "@/infrastructure/container";
import { BarberStep } from "@/presentation/components/booking/barber-step";
import { DataStep } from "@/presentation/components/booking/data-step";
import { ServiceStep } from "@/presentation/components/booking/service-step";
import { StepProgress } from "@/presentation/components/booking/step-progress";
import { TimeStep } from "@/presentation/components/booking/time-step";
import { ANY_BARBER, bookingHref, resolveStep } from "@/presentation/lib/booking-flow";
import { daysBetween } from "@/presentation/lib/days";
import { createAppointmentAction } from "./actions";
import { parseBookingQuery } from "./booking-schema";

export const metadata: Metadata = { title: "Reservar cita" };

export default function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  return (
    // pb extra en móvil: el resumen va fijo abajo.
    <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-32 sm:px-6 lg:pb-24">
      <h1 className="mb-6 font-heading text-4xl sm:text-5xl">Reservar cita</h1>
      <Suspense fallback={<p className="min-h-[40rem] text-muted-foreground">Cargando…</p>}>
        <Booking searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Booking({ searchParams }: Pick<PageProps<"/reservar">, "searchParams">) {
  const { requestedStep, selection: fromUrl } = parseBookingQuery(await searchParams);
  const { getCatalog, getAvailableSlots } = getUseCases();
  const { services, barbers, products, weeklyHours } = await getCatalog.execute();

  // Lo que llega en la URL solo cuenta si sigue existiendo en el catálogo.
  const chosen = services.filter((s) => fromUrl.servicios.includes(s.id));
  const barber = barbers.find((b) => b.id === fromUrl.barbero);
  const anyBarber = fromUrl.barbero === ANY_BARBER;

  const { notBefore, notAfter } = bookingWindow(new Date());
  const closed = (date: string) => !weeklyHours[shopWeekday(date)]?.length;
  const dates = daysBetween(shopDateOf(notBefore), shopDateOf(notAfter));
  const dia = fromUrl.dia && dates.includes(fromUrl.dia) ? fromUrl.dia : dates.find((d) => !closed(d));

  const selection = {
    servicios: chosen.map((s) => s.id),
    barbero: barber || anyBarber ? fromUrl.barbero : undefined,
    dia,
    hora: fromUrl.hora,
  };
  let step = resolveStep(requestedStep, selection);
  const progress = (current: typeof step) => <StepProgress current={current} selection={selection} />;

  if (step === 1) return <ServiceStep progress={progress(1)} services={services} selection={selection} />;
  if (step === 2) {
    return <BarberStep progress={progress(2)} barbers={barbers} services={chosen} selection={selection} />;
  }

  const barberId = selection.barbero;
  if (!barberId || !dia) return <p>Por ahora no hay días disponibles para reservar. Escríbenos por WhatsApp.</p>;

  const slots = (
    await getAvailableSlots.execute({
      barberId: anyBarber ? null : barberId,
      serviceIds: selection.servicios,
      date: dia,
    })
  ).map((s) => s.start.toISOString());

  // La hora pudo ocuparse desde que se eligió: se vuelve al paso 3 con un aviso.
  const wantedHour = selection.hora;
  const hourGone = step === 4 && !(wantedHour && slots.includes(wantedHour));
  if (hourGone) step = 3;

  if (step === 4 && wantedHour) {
    return (
      <DataStep
        progress={progress(4)}
        action={createAppointmentAction}
        selection={{ ...selection, barbero: barberId, hora: wantedHour }}
        services={chosen}
        products={products}
        barbers={barbers}
        barberName={barber?.name ?? "el barbero disponible"}
      />
    );
  }

  const withDay = (date: string) => bookingHref(3, { ...selection, dia: date, hora: undefined });
  const nextDay = dates.find((d) => d > dia && !closed(d));
  return (
    <TimeStep
      progress={progress(3)}
      selection={{ ...selection, dia, hora: undefined }}
      days={dates.map((date) => ({ date, href: withDay(date), closed: closed(date) }))}
      slots={slots}
      closed={closed(dia)}
      nextDayHref={nextDay && withDay(nextDay)}
      notice={hourGone ? "Esa hora ya no está libre. Elige otra." : undefined}
      services={chosen}
      barberName={barber?.name}
    />
  );
}
