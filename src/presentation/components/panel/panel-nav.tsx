"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/presentation/lib/utils";

const SECTIONS = [
  { href: "/panel", label: "Agenda" },
  { href: "/panel/servicios", label: "Servicios" },
  { href: "/panel/productos", label: "Productos" },
  { href: "/panel/barberos", label: "Barberos" },
  { href: "/panel/horario", label: "Horario" },
  { href: "/panel/web", label: "Web" },
];

/** Solo navegación: cada página y acción del panel comprueba la sesión por su cuenta. */
export function PanelNav({ logout }: { logout: () => Promise<void> }) {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);
  // En el móvil las pestañas se deslizan: la actual debe quedar a la vista.
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  if (pathname === "/panel/entrar") return null;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <nav aria-label="Secciones del panel" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {SECTIONS.map(({ href, label }) => (
          <Link
            key={href}
            ref={pathname === href ? current : undefined}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-primary",
              pathname === href ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary",
            )}
          >
            {label}
          </Link>
        ))}
        <form action={logout} className="ml-auto shrink-0">
          <button type="submit" className="min-h-11 cursor-pointer px-3 text-sm text-muted-foreground underline underline-offset-4">
            Cerrar sesión
          </button>
        </form>
      </nav>
    </div>
  );
}
