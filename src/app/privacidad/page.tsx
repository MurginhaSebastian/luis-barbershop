import type { Metadata } from "next";
import { Suspense } from "react";
import { getSiteSettings } from "../site-settings";

export const metadata: Metadata = { title: "Política de privacidad" };

const h2 = "mt-10 font-heading text-2xl";

async function Contact() {
  const { contact } = await getSiteSettings();
  const parts = [contact.address, contact.whatsapp && `WhatsApp +${contact.whatsapp}`].filter(Boolean);
  return (
    <p className="mt-3">
      {parts.length ? `Contacto: ${parts.join(" · ")}.` : "Escríbenos por los medios de contacto de esta web."}
    </p>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto w-full max-w-prose px-4 pt-4 pb-24 leading-relaxed sm:px-6">
      <h1 className="font-heading text-4xl sm:text-5xl">Política de privacidad</h1>
      <p className="mt-3 text-sm text-muted-foreground">Última actualización: 22 de noviembre de 2026.</p>

      <h2 className={h2}>Responsable</h2>
      <p className="mt-3">Luis Barbershop, Trujillo, Perú, es quien decide cómo se usan tus datos personales.</p>
      <Suspense fallback={<p className="mt-3 text-muted-foreground">Cargando contacto…</p>}>
        <Contact />
      </Suspense>

      <h2 className={h2}>Qué datos guardamos</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>Tu nombre y tu celular, cuando reservas.</li>
        <li>Los servicios, la fecha y la hora de tu cita.</li>
        <li>
          Si escribes al WhatsApp automático, tus mensajes y las respuestas del asistente. Ese historial se borra pasadas
          24 horas.
        </li>
      </ul>

      <h2 className={h2}>Para qué los usamos</h2>
      <p className="mt-3">
        Para gestionar tu cita, confirmarla y recordártela por WhatsApp. No usamos tus datos para publicidad ni los
        vendemos.
      </p>

      <h2 className={h2}>Base legal</h2>
      <p className="mt-3">
        Tratamos tus datos para ejecutar la reserva que tú pides, conforme a la Ley N.° 29733, Ley de Protección de Datos
        Personales, y su reglamento.
      </p>

      <h2 className={h2}>Con quién los compartimos</h2>
      <p className="mt-3">Solo con proveedores que nos prestan el servicio y tratan los datos por nuestra cuenta:</p>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>El servicio de alojamiento web y de base de datos.</li>
        <li>WhatsApp (Meta), para enviar y recibir los mensajes.</li>
        <li>El proveedor de inteligencia artificial (Groq), solo si el asistente automático está activo.</li>
      </ul>
      <p className="mt-3">
        Estos proveedores pueden tener sus servidores fuera del Perú, por lo que tus datos pueden transferirse al
        extranjero para estos fines.
      </p>

      <h2 className={h2}>Cuánto tiempo los conservamos</h2>
      <p className="mt-3">
        Las citas se conservan como historial del negocio. Los mensajes del asistente automático se borran pasadas 24
        horas.
      </p>

      <h2 className={h2}>Cookies</h2>
      <p className="mt-3">
        La web pública no usa cookies de seguimiento ni de analítica. Solo existe una cookie de sesión para el panel del
        barbero.
      </p>

      <h2 className={h2}>Tus derechos</h2>
      <p className="mt-3">
        Puedes pedir acceso, rectificación, cancelación y oposición (derechos ARCO) sobre tus datos por el contacto de
        esta web. Si no te respondemos bien, puedes reclamar ante la Autoridad Nacional de Protección de Datos
        Personales.
      </p>
    </main>
  );
}
