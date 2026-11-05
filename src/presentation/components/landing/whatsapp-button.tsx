"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

/** Botón flotante de WhatsApp; en móvil queda por encima de la barra fija de "Reservar cita". */
export function WhatsappButton({ href }: { href: string }) {
  // En la reserva taparía las horas de la columna derecha.
  if (usePathname() === "/reservar") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed right-4 bottom-24 z-30 grid size-14 cursor-pointer place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-black/40 transition-colors duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:right-6 md:bottom-6"
    >
      <MessageCircle aria-hidden className="size-7" />
    </a>
  );
}
