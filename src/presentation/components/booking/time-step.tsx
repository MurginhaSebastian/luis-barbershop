import Link from "next/link";
import type { ReactNode } from "react";
import type { Service } from "@/core/entities/catalog";
import { bookingHref, type BookingSelection } from "@/presentation/lib/booking-flow";
import { groupByDayPart } from "@/presentation/lib/days";
import { formatTime } from "@/presentation/lib/format";
import { BookingSummary } from "./booking-summary";
import { DayStrip, type DayOption } from "./day-strip";
import { PendingHint } from "./pending-hint";
import { StepLayout } from "./step-layout";

const slotClass =
  "flex min-h-12 cursor-pointer items-center justify-center gap-1 rounded-xl border border-border tabular-nums transition-colors duration-200 hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Paso 3: día y hora. Un toque en la hora avanza a los datos. */
export function TimeStep(props: {
  progress: ReactNode;
  selection: BookingSelection & { dia: string };
  days: DayOption[];
  slots: string[];
  closed: boolean;
  nextDayHref?: string;
  notice?: string;
  services: Service[];
  barberName?: string;
}) {
  return (
    // key: sin ella React reutiliza la plantilla entre pasos y no mueve el foco al título.
    <StepLayout
      key="time-step"
      progress={props.progress}
      title="¿Qué día y a qué hora?"
      backHref={bookingHref(2, props.selection)}
      summary={<BookingSummary services={props.services} barberName={props.barberName} />}
    >
      {props.notice && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/60 px-4 py-3 text-destructive">
          {props.notice}
        </p>
      )}
      <DayStrip days={props.days} selected={props.selection.dia} />

      <div aria-live="polite" className="mt-8 space-y-6">
        {groupByDayPart(props.slots).map((part) => (
          <section key={part.label} aria-label={part.label}>
            <h3 className="mb-3 text-muted-foreground">{part.label}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {part.slots.map((iso) => (
                <li key={iso}>
                  <Link href={bookingHref(4, { ...props.selection, hora: iso })} prefetch={false} className={slotClass}>
                    {formatTime(iso)}
                    <PendingHint />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {props.slots.length === 0 && (
          <div>
            <p>
              {props.closed
                ? "Ese día la barbería está cerrada."
                : `No quedan horas libres ese día${props.barberName ? ` con ${props.barberName}` : ""}.`}
            </p>
            {props.nextDayHref && (
              <Link
                href={props.nextDayHref}
                scroll={false}
                prefetch={false}
                className="mt-2 inline-flex min-h-11 items-center text-primary underline underline-offset-4"
              >
                Ver el siguiente día
              </Link>
            )}
          </div>
        )}
      </div>
    </StepLayout>
  );
}
