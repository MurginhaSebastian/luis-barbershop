import type { Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";

/** Lista de precios como la pizarra de una barbería: nombre, puntos guía y precio. */
export function ServiceMenu({ services }: { services: Service[] }) {
  if (services.length === 0) return <p className="text-muted-foreground">Pronto publicaremos nuestros servicios.</p>;
  return (
    <ul className="space-y-5">
      {services.map((s) => (
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
