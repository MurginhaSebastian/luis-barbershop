import { Check } from "lucide-react";
import Link from "next/link";
import { BOOKING_STEPS, bookingHref, type BookingSelection, type BookingStep } from "@/presentation/lib/booking-flow";
import { cn } from "@/presentation/lib/utils";

/** Progreso de la reserva; los pasos ya hechos son enlaces para volver a cambiarlos. */
export function StepProgress({ current, selection }: { current: BookingStep; selection: BookingSelection }) {
  return (
    <nav aria-label="Pasos de la reserva">
      <ol className="grid grid-cols-4">
        {BOOKING_STEPS.map(({ step, label }) => {
          const done = step < current;
          const content = (
            <>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border text-sm font-semibold tabular-nums",
                  done && "border-primary bg-primary text-primary-foreground",
                  step === current && "border-primary text-primary",
                  step > current && "border-input text-muted-foreground",
                )}
              >
                {done ? <Check aria-hidden className="size-4" /> : step}
              </span>
              <span className={cn("text-xs sm:text-sm", step > current ? "text-muted-foreground" : "text-foreground")}>
                {label}
              </span>
            </>
          );
          return (
            <li key={step} aria-current={step === current ? "step" : undefined}>
              {done ? (
                <Link
                  href={bookingHref(step, selection)}
                  aria-label={`Volver a ${label}`}
                  className="flex min-h-14 cursor-pointer flex-col items-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-14 flex-col items-center gap-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
