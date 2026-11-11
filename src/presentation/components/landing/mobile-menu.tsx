"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Secciones de la portada en el móvil. Sin JavaScript también abre y cierra: es un <details>. */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => menu.current?.removeAttribute("open");

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      menu.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <details ref={menu} onToggle={(e) => setOpen(e.currentTarget.open)} className="md:hidden">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        {/* En pantallas muy estrechas solo se ve el icono; el nombre sigue para lectores de pantalla. */}
        <span className="max-[369px]:sr-only">Menú</span>
      </summary>
      <nav aria-label="Secciones" className="absolute inset-x-0 top-full border-b border-border bg-background shadow-lg shadow-black/40">
        <ul className="mx-auto w-full max-w-6xl px-4 py-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                className="flex min-h-12 items-center border-b border-border/60 font-heading text-xl transition-colors duration-200 last:border-0 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
