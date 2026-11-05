import type { Service } from "@/core/entities/catalog";
import { formatLongDate, formatPrice, formatTime } from "@/presentation/lib/format";

/** Lo elegido hasta ahora: barra fija abajo en móvil y columna lateral en escritorio. */
export function BookingSummary(props: { services: Service[]; barberName?: string; hora?: string; extraCents?: number }) {
  const minutes = props.services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const total = props.services.reduce((sum, s) => sum + s.priceCents, 0) + (props.extraCents ?? 0);
  return (
    <aside
      aria-label="Resumen de tu reserva"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:sticky lg:top-6 lg:rounded-2xl lg:border lg:p-6"
    >
      <h2 className="hidden font-heading text-2xl lg:block">Tu reserva</h2>
      {props.services.length === 0 ? (
        <p className="text-sm text-muted-foreground lg:mt-4">Elige al menos un servicio.</p>
      ) : (
        <>
          <ul className="mt-4 hidden space-y-1 lg:block">
            {props.services.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 text-sm">
                <span>{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{formatPrice(s.priceCents)}</span>
              </li>
            ))}
          </ul>
          {props.barberName && <p className="mt-3 hidden text-sm lg:block">Con {props.barberName}</p>}
          {props.hora && (
            <p className="mt-1 hidden text-sm first-letter:uppercase lg:block">
              {formatLongDate(props.hora)}, {formatTime(props.hora)}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3 lg:mt-4 lg:border-t lg:border-border lg:pt-4">
            <p className="text-sm text-muted-foreground">
              {props.services.length === 1 ? "1 servicio" : `${props.services.length} servicios`}, {minutes} min
            </p>
            <p className="font-heading text-2xl tabular-nums text-primary">{formatPrice(total)}</p>
          </div>
        </>
      )}
    </aside>
  );
}
