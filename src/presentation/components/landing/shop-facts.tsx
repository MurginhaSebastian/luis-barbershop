import { formatPrice } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";
import { container } from "./styles";

interface Fact {
  label: string;
  value: string;
  link?: { href: string; text: string; external?: boolean };
  dot?: "open" | "closed";
}

const linkClass =
  "inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Lo primero que pregunta quien llega: si está abierto, dónde queda y cuánto cuesta. Solo datos reales. */
export function ShopFacts(props: {
  opening: string | null;
  isOpen: boolean;
  showHours: boolean;
  address?: string;
  mapsUrl?: string;
  fromCents: number | null;
}) {
  const facts: Fact[] = [];
  if (props.opening) {
    facts.push({
      label: "Hoy",
      value: props.opening,
      dot: props.isOpen ? "open" : "closed",
      link: props.showHours ? { href: "#horario", text: "Ver horario" } : undefined,
    });
  }
  if (props.address) {
    facts.push({
      label: "Dónde",
      value: props.address,
      link: props.mapsUrl ? { href: props.mapsUrl, text: "Cómo llegar", external: true } : undefined,
    });
  }
  if (props.fromCents !== null) {
    facts.push({ label: "Precios", value: `Desde ${formatPrice(props.fromCents)}`, link: { href: "#servicios", text: "Ver servicios" } });
  }
  if (facts.length === 0) return null;

  return (
    <section aria-label="Datos de la barbería" className="border-b border-border bg-card/50">
      <dl className={`${container} grid divide-y divide-border sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0`}>
        {facts.map((fact) => (
          <div key={fact.label} className="py-5 sm:px-6 sm:first:pl-0 sm:last:pr-0">
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              {fact.dot && (
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 translate-y-[-0.1em] rounded-full", fact.dot === "open" ? "bg-primary" : "bg-muted-foreground")}
                />
              )}
              {fact.value}
            </dd>
            {fact.link && (
              <dd>
                <a
                  href={fact.link.href}
                  className={linkClass}
                  {...(fact.link.external && { target: "_blank", rel: "noopener noreferrer" })}
                >
                  {fact.link.text}
                </a>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
