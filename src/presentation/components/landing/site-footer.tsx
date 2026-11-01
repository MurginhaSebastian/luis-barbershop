import Link from "next/link";
import { container } from "./styles";

const linkClass = "inline-flex min-h-11 items-center text-muted-foreground transition-colors duration-200 hover:text-primary";

export function SiteFooter(props: {
  whatsappHref?: string;
  address?: string;
  mapsUrl?: string;
  socials: { label: string; href?: string }[];
  complaintsUrl?: string;
}) {
  const socials = props.socials.filter((s) => s.href);
  return (
    // pb extra en móvil: la portada tiene una barra fija de "Reservar cita" abajo.
    <footer className="border-t border-border bg-card pb-24 md:pb-0">
      <div className={`${container} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <p className="font-heading text-2xl text-primary">Luis Barbershop</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Cortes, fades y barba. Reserva en línea y te confirmamos por WhatsApp.
          </p>
        </div>

        <nav aria-label="Contacto">
          <p className="font-semibold">Contacto</p>
          <ul className="mt-2">
            <li>
              <Link href="/reservar" className={linkClass}>
                Reservar cita
              </Link>
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
                  <span className="text-muted-foreground">{props.address}</span>
                )}
              </li>
            )}
          </ul>
        </nav>

        {socials.length > 0 && (
          <nav aria-label="Redes sociales">
            <p className="font-semibold">Síguenos</p>
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
            <p className="font-semibold">Atención al cliente</p>
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
    </footer>
  );
}
