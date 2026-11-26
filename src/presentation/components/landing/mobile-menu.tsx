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
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menu.current?.open) return;
      close();
      menu.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
    // Siempre montados: así Escape funciona en cuanto el menú se abre, sin esperar al render de `open`.
  }, []);

  return (
    <details ref={menu} onToggle={(e) => setOpen(e.currentTarget.open)} className="xl:hidden">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm border border-dark-outline px-3 font-label text-label-lg text-on-dark-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        {/* En pantallas muy estrechas solo se ve el icono; el nombre sigue para lectores de pantalla. */}
        <span className="max-[369px]:sr-only">Menú</span>
      </summary>
      <nav aria-label="Secciones" className="absolute inset-x-0 top-full border-b border-dark-outline bg-dark-elevated shadow-lg shadow-black/40">
        <ul className="mx-auto w-full max-w-6xl px-4 py-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                className="flex min-h-12 items-center border-b border-dark-outline font-label text-label-lg text-on-dark-canvas transition-colors duration-150 last:border-0 hover:text-gold focus-visible:outline-2 focus-visible:outline-gold"
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
