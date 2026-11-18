import { whatsappLink } from "./whatsapp";

/** A dónde lleva un botón de reservar: al WhatsApp del asistente si está activo; si no, a la web. */
export function bookingCta(
  assistant: string | null | undefined,
  opts: { text?: string; webHref?: string } = {},
): { href: string; external: boolean } {
  if (assistant) return { href: whatsappLink(assistant, opts.text ?? "Hola, quiero reservar una cita"), external: true };
  return { href: opts.webHref ?? "/reservar", external: false };
}
