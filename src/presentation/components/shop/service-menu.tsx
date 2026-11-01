import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";

/** Pizarra de precios: nombre, puntos guía y precio; el más caro (el servicio principal) primero. */
export function ServiceMenu({ services }: { services: Service[] }) {
  if (services.length === 0) return <p className="text-muted-foreground">Pronto publicaremos nuestros servicios.</p>;
  return (
    <ul className="space-y-5">
      {services.toSorted((a, b) => b.priceCents - a.priceCents).map((s) => (
        <li key={s.id}>
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-xl">{s.name}</span>
            <span aria-hidden className="flex-1 -translate-y-1 border-b border-dotted border-primary/40" />
            <span className="tabular-nums text-primary">{formatPrice(s.priceCents)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{s.durationMinutes} min</p>
        </li>
      ))}
    </ul>
  );
}
