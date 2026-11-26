import { SHOP_NAME } from "@/core/entities/site";
import Image from "next/image";
import Link from "next/link";
import { BookLink } from "./book-link";
import { container } from "./styles";

const linkClass = "inline-flex min-h-11 items-center text-dark-muted transition-colors duration-150 hover:text-gold";
const headClass = "font-title text-title-md text-on-dark-canvas";

export function SiteFooter(props: {
  whatsappHref?: string;
  assistant?: string | null;
  address?: string;
  mapsUrl?: string;
  socials: { label: string; href?: string }[];
  complaintsUrl?: string;
}) {
  const socials = props.socials.filter((s) => s.href);
  return (
    // pb extra en móvil: la portada tiene una barra fija de "Reservar cita" abajo.
    <footer className="border-t border-gold/40 bg-dark-canvas pb-24 font-body text-body-md md:pb-0">
      <div className={`${container} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <Image src="/images/logo-sello.webp" alt="" width={96} height={96} sizes="96px" className="mb-3 size-20" />
          <p className="font-headline text-title-lg text-gold">{SHOP_NAME}</p>
          <p className="mt-3 max-w-xs text-dark-muted">Cortes, fades y barba. Reserva en línea y te confirmamos por WhatsApp.</p>
        </div>

        <nav aria-label="Contacto">
          <p className={headClass}>Contacto</p>
          <ul className="mt-2">
            <li>
              <BookLink assistant={props.assistant} className={linkClass}>
                Reservar cita
              </BookLink>
            </li>
            {props.whatsappHref && (
              <li>
                <a href={props.whatsappHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  WhatsApp
                </a>
              </li>
            )}
            {props.address && (
              <li>
                {props.mapsUrl ? (
                  <a href={props.mapsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {props.address}
                  </a>
                ) : (
                  <span className="text-dark-muted">{props.address}</span>
                )}
              </li>
            )}
          </ul>
        </nav>

        {socials.length > 0 && (
          <nav aria-label="Redes sociales">
            <p className={headClass}>Síguenos</p>
            <ul className="mt-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {props.complaintsUrl && (
          <nav aria-label="Información legal">
            <p className={headClass}>Atención al cliente</p>
            <ul className="mt-2">
              <li>
                <a href={props.complaintsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Libro de Reclamaciones
                </a>
              </li>
            </ul>
          </nav>
        )}
      </div>
      <div className={`${container} flex flex-wrap gap-x-6 gap-y-2 border-t border-dark-outline py-4`}>
        <Link href="/privacidad" className={`${linkClass} underline underline-offset-4`}>
          Política de privacidad
        </Link>
        <Link href="/panel/entrar" className={linkClass}>
          Acceso barbero
        </Link>
      </div>
    </footer>
  );
}
