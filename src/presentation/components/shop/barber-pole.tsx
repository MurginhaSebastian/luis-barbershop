import { cn } from "@/presentation/lib/utils";

/** Poste de barbero decorativo: franja horizontal en móvil, columna vertical desde md. */
export function BarberPole({ className }: { className?: string }) {
  const cap = "shrink-0 rounded-full bg-primary";
  return (
    <div aria-hidden className={cn("flex items-center gap-1 md:flex-col", className)}>
      <span className={cn(cap, "h-full w-3 md:h-5 md:w-full")} />
      <span className="barber-pole h-full flex-1 animate-pole rounded-full ring-1 ring-primary/50 motion-reduce:animate-none md:h-auto md:w-full" />
      <span className={cn(cap, "h-full w-3 md:h-5 md:w-full")} />
    </div>
  );
}
