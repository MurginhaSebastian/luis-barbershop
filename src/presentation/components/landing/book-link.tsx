import Link from "next/link";
import type { ReactNode } from "react";
import { bookingCta } from "@/presentation/lib/booking-cta";

/** Botón de reservar: con asistente activo abre su WhatsApp; sin él, la reserva web. */
export function BookLink({
  assistant,
  text,
  webHref,
  className,
  children,
}: {
  assistant?: string | null;
  text?: string;
  webHref?: string;
  className?: string;
  children: ReactNode;
}) {
  const { href, external } = bookingCta(assistant, { text, webHref });
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
