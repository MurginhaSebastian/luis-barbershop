import { MapPin } from "lucide-react";
import { cn } from "@/presentation/lib/utils";

const link = "inline-flex min-h-6 items-center text-on-obsidian-bar transition-colors duration-150 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** Barra superior de la portada: dirección, si está abierto ahora y redes. Solo datos de `site_settings` y del horario. */
export function TopBar({
  address,
  opening,
  isOpen,
  socials,
}: {
  address?: string;
  opening: string | null;
  isOpen: boolean;
  socials: { label: string; href?: string }[];
}) {
  const links = socials.filter((s) => s.href);
  if (!address && !opening && links.length === 0) return null;
  return (
    <div className="border-b border-dark-outline bg-obsidian-bar font-body text-body-md text-on-obsidian-bar">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-gutter-lg gap-y-1 px-4 py-2 sm:px-6 md:justify-between lg:px-8">
        {address && (
          <p className="flex items-center gap-gutter-xs">
            <MapPin aria-hidden className="size-4 shrink-0 text-gold" />
            {address}
          </p>
        )}
        {opening && (
          <p className="flex items-center gap-gutter-sm tabular-nums">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", isOpen ? "bg-status-open" : "bg-dark-muted")} />
            {opening}
          </p>
        )}
        {links.length > 0 && (
          <ul className="hidden items-center gap-gutter-md sm:flex">
            {links.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={link}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
