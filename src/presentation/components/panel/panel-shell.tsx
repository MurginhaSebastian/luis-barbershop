"use client";

import { CalendarDays, Clock, ExternalLink, Globe, LogOut, MessageSquare, Package, Scissors, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { SHOP_NAME } from "@/core/entities/site";
import { cn } from "@/presentation/lib/utils";

const SECTIONS = [
  { href: "/panel", label: "Agenda", Icon: CalendarDays },
  { href: "/panel/chats", label: "Chats", Icon: MessageSquare },
  { href: "/panel/servicios", label: "Servicios", Icon: Scissors },
  { href: "/panel/productos", label: "Productos", Icon: Package },
  { href: "/panel/barberos", label: "Barberos", Icon: Users },
  { href: "/panel/horario", label: "Horarios", Icon: Clock },
  { href: "/panel/web", label: "Web", Icon: Globe },
];

const item =
  "flex min-h-11 shrink-0 items-center gap-gutter-sm rounded-sm border-l-2 px-3 font-label text-label-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold";

/**
 * Cascarón del panel: barra lateral negra (en el móvil, una franja con las secciones deslizables) y contenido en crema.
 * Solo navegación: cada página y acción del panel comprueba la sesión por su cuenta. La entrada no lleva cascarón.
 */
export function PanelShell({ logout, children }: { logout: () => Promise<void>; children: ReactNode }) {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);
  // En el móvil las secciones se deslizan: la actual debe quedar a la vista.
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  if (pathname === "/panel/entrar") return children;
  return (
    <div data-panel-shell className="panel-light flex min-h-dvh flex-col bg-light-canvas text-on-light-canvas lg:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-dark-outline bg-dark-canvas text-on-dark-canvas lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-gutter-sm px-4 py-3 lg:border-b lg:border-dark-outline lg:py-5">
          <Image src="/images/logo-sello.webp" alt="" width={36} height={36} sizes="36px" className="size-9 shrink-0 rounded-sm" />
          <p className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-headline text-title-md">{SHOP_NAME}</span>
            <span className="font-eyebrow text-label-sm text-gold uppercase">Panel</span>
          </p>
        </div>
        <nav aria-label="Secciones del panel" className="flex min-w-0 gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-4">
          {SECTIONS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                ref={active ? current : undefined}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(item, active ? "border-gold bg-dark-elevated text-gold" : "border-transparent text-dark-muted hover:bg-dark-elevated hover:text-on-dark-canvas")}
              >
                <Icon aria-hidden className="size-4.5 shrink-0" />
                {label}
              </Link>
            );
          })}
          <div className="flex shrink-0 gap-1 max-lg:ml-auto lg:mt-auto lg:flex-col lg:border-t lg:border-dark-outline lg:pt-3">
            <Link href="/" className={cn(item, "border-transparent text-on-dark-canvas hover:text-gold lg:border lg:border-dark-outline lg:hover:border-gold")}>
              <ExternalLink aria-hidden className="size-4.5 shrink-0" />
              Ir a la portada
            </Link>
            <form action={logout} className="flex">
              <button type="submit" className={cn(item, "w-full cursor-pointer border-transparent text-dark-muted hover:bg-dark-elevated hover:text-gold")}>
                <LogOut aria-hidden className="size-4.5 shrink-0" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
