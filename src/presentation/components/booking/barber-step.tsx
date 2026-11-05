import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Barber, Service } from "@/core/entities/catalog";
import { ANY_BARBER, bookingHref, type BookingSelection } from "@/presentation/lib/booking-flow";
import { BookingSummary } from "./booking-summary";
import { PendingHint } from "./pending-hint";
import { StepLayout } from "./step-layout";
import { linkChoiceClass } from "./styles";

/** Paso 2: un toque en el barbero avanza; cambiar de barbero invalida la hora ya elegida. */
export function BarberStep(props: {
  progress: ReactNode;
  barbers: Barber[];
  services: Service[];
  selection: BookingSelection;
}) {
  const next = (barbero: string) => bookingHref(3, { ...props.selection, barbero, hora: undefined });
  return (
    <StepLayout
      progress={props.progress}
      title="¿Con quién?"
      backHref={bookingHref(1, props.selection)}
      summary={<BookingSummary services={props.services} />}
    >
      <ul className="grid gap-2">
        {props.barbers.map((b) => (
          <li key={b.id}>
            <Link href={next(b.id)} className={linkChoiceClass}>
              <span aria-hidden className="grid size-10 place-items-center rounded-full bg-secondary font-heading text-xl text-primary">
                {b.name[0]}
              </span>
              <span className="flex-1 font-medium">{b.name}</span>
              <PendingHint />
              <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <Link href={next(ANY_BARBER)} className={linkChoiceClass}>
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-secondary text-primary">
              <Users className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">Sin preferencia</span>
              <span className="block text-sm text-muted-foreground">Verás más horas disponibles</span>
            </span>
            <PendingHint />
            <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
          </Link>
        </li>
      </ul>
    </StepLayout>
  );
}
