# Luis Barbershop

Web de una barbería en Lima: los clientes reservan su hora en línea y el barbero lleva la agenda, el catálogo y
la web desde un panel propio. Precios en soles, horario de Lima.

## Qué hace

**Para el cliente**
- Portada con video, servicios con precio y duración, horario, ubicación y un aviso de si está abierto ahora.
- Reserva en 4 pasos, sin cuenta: servicios (uno o varios), barbero o "sin preferencia", día y hora libres,
  nombre y celular. Puede sumar productos para recogerlos en el local.
- Confirma su cita por WhatsApp con un toque (mensaje con su código). Si no confirma en 2 h (o hasta 1 h antes
  de la cita), la hora se libera sola y se le avisa.
- Botón de WhatsApp y enlaces a redes, si la barbería los configura.

**Para el barbero** (`/panel`, con una clave)
- Agenda del día y citas por confirmar, con hasta cuándo puede confirmar cada cliente; también puede
  confirmar o cancelar a mano (abre WhatsApp con el mensaje escrito).
- Aviso push en el celular o la PC cuando alguien reserva y cuando confirma por WhatsApp.
- Servicios, productos, barberos, horario y bloqueos (feriados, vacaciones). Nada con citas se borra:
  se oculta.
- La web: contacto, secciones visibles y fotos (se reducen y pierden los datos de ubicación al subirlas).

## Tecnología

Next.js 16 (App Router, Partial Prerender) · React 19 · TypeScript estricto · Tailwind CSS 4 · shadcn/ui ·
Zod 4 · PostgreSQL 17 + Drizzle · Web Push (VAPID) · WhatsApp Cloud API · Vitest · Playwright + axe ·
Lighthouse.

Organizada en **Clean Architecture**. Las dependencias solo apuntan hacia dentro y ESLint lo hace cumplir:

```
app (rutas, Server Actions)  ──►  presentation (UI)  ──►  application (casos de uso, puertos)  ──►  core (dominio)
                                  infrastructure (Postgres, push, fotos)  ──►  application
```

| Carpeta | Contenido |
|---|---|
| `src/core/` | Entidades, reglas y agenda (huecos libres, apertura). TypeScript puro, sin librerías. |
| `src/application/` | Casos de uso y puertos (interfaces de repositorios, avisos, fotos). |
| `src/infrastructure/` | Postgres/Drizzle, Web Push, WhatsApp, almacenamiento de fotos, sesión del panel. `container.ts` lo monta todo. |
| `src/presentation/` | Componentes (portada, reserva, panel) y utilidades de formato. |
| `src/app/` | Páginas, Server Actions y rutas (`/api/whatsapp`, `/api/cron/vencer`): validan con Zod y llaman al caso de uso. |
| `e2e/` | Pruebas de navegador. |
| `scripts/` | Clave del panel, claves VAPID, video de portada, Lighthouse, mutaciones y carga. |

## Puesta en marcha

Requisitos: Node 24, Docker Desktop.

```bash
npm install
cp .env.example .env
npm run db:up        # Postgres en Docker, puerto 5433
npm run db:migrate
npm run db:seed      # datos de ejemplo ficticios
npm run panel:clave  # clave del panel: copia las líneas PANEL_* a .env
npm run panel:push   # opcional, avisos push: copia las líneas VAPID_* a .env
npm run dev          # http://localhost:3000 (panel en /panel)
```

## Variables de entorno

| Variable | Para qué | Notas |
|---|---|---|
| `DATABASE_URL` | Postgres | Con Supabase solo cambia esta. |
| `PANEL_PASSWORD_HASH`, `PANEL_SESSION_SECRET` | Entrar al panel | `npm run panel:clave`. Sin ellas nadie entra. |
| `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Avisos push | `npm run panel:push`. Cambiarlas obliga a reactivar cada dispositivo. |
| `SUPABASE_URL` | Fotos en Supabase Storage | Debe existir **también al compilar**: `next.config.ts` la usa para permitir sus imágenes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Subir fotos | Solo servidor; nunca con prefijo `NEXT_PUBLIC_`. |
| `SUPABASE_BUCKET` | Bucket público de las fotos | |
| `IMAGE_STORAGE` | `local` guarda las fotos en disco | Sin Supabase, solo en un servidor con disco persistente. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Confirmación por WhatsApp | Ver [Configurar WhatsApp](#configurar-whatsapp). Sin ellas las citas se confirman a mano y no vencen. |
| `CRON_SECRET` | Liberar citas sin confirmar | La tarea `GET /api/cron/vencer` lo exige; se llama cada 5 minutos. |
| `SITE_URL` | Enlaces en los mensajes | La dirección pública, con `https://`. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run check` | Lint (cero avisos), tipos, tests y build. Obligatorio antes de cada commit. |
| `npm test` | Pruebas unitarias y de integración (Vitest; la integración usa la base `barbershop_test`). |
| `npm run test:coverage` | Cobertura, con mínimos obligatorios. |
| `npm run test:mutation` | Rompe reglas críticas a propósito y exige que algún test lo detecte. |
| `npm run test:e2e` | Navegador (Edge) contra el build real, con axe, en móvil y escritorio. |
| `npm run test:devices` | iPhone, iPad, Android, Safari, Firefox y Edge a 1920; deja capturas en `test-results/`. La primera vez: `npx playwright install webkit firefox`. |
| `npm run lighthouse -- <url>` | Lighthouse en móvil y escritorio sobre `npm run build && npm start`; informes en `.lighthouse/`. |
| `npm run media:video -- <video> --horizontal\|--vertical [--inicio s]` | Prepara el video de portada (necesita ffmpeg: `winget install Gyan.FFmpeg`). |
| `npm run db:generate` / `db:migrate` / `db:seed` | Migraciones y datos de ejemplo. |

## Calidad

- **Lógica:** 413 pruebas, cobertura mínima del 90 % de líneas y 52 mutantes de reglas críticas (agenda,
  dinero, sesión, enlaces, fotos, avisos, WhatsApp), todos detectados.
- **Navegador:** reserva, panel, confirmación por WhatsApp de punta a punta (contra un WhatsApp falso),
  accesibilidad con axe, teclado, cabeceras de seguridad, y 7 dispositivos emulados en los tres motores.
- **Lighthouse** (noviembre 2026): 95–100 en rendimiento y 100 en accesibilidad, buenas prácticas y SEO.
  El panel tiene SEO bajo a propósito: no debe aparecer en buscadores.
- Detalle en [`docs/qa-2026-11.md`](docs/qa-2026-11.md) y [`docs/auditoria-2026-11.md`](docs/auditoria-2026-11.md).

## Antes de publicar

1. Base de datos en el hosting (o Supabase) y `npm run db:migrate` contra ella.
2. `PANEL_*` y `VAPID_*` **nuevas** para producción, no las de desarrollo.
3. Fotos: `SUPABASE_*` disponibles al compilar y al ejecutar.
4. HTTPS: sin él no hay avisos push en el celular.
5. Video real de la barbería con `npm run media:video` y testimonios reales con permiso.
6. WhatsApp configurado (abajo), con `SITE_URL` y la tarea de vencer citas programada cada 5 minutos.

## Configurar WhatsApp

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Business** y añade el
   producto **WhatsApp**. Para probar, Meta da un número de prueba.
2. En *WhatsApp > API Setup* copia el **Phone number ID** a `WHATSAPP_PHONE_NUMBER_ID`, y en *Configuración
   de la app > Básica* el **App secret** a `WHATSAPP_APP_SECRET`. Para producción, crea un usuario del
   sistema en Meta Business con un **token permanente** (`WHATSAPP_TOKEN`).
3. Inventa un `WHATSAPP_VERIFY_TOKEN` largo. En *WhatsApp > Configuration > Webhook* pon la URL
   `https://<tu-dominio>/api/whatsapp` y ese token, y suscríbete al campo **messages**. En local, expón el
   puerto con `ngrok http 3000` y usa su dirección.
4. Crea y espera la aprobación de la plantilla **`cita_vencida`** (categoría utilidad, idioma *Spanish*, `es`):
   cuerpo "Hola {{1}}, tu reserva del {{2}} se liberó porque no se confirmó a tiempo. Cuando quieras, reserva
   otra hora." y un botón de URL "Reservar" con la dirección fija `https://<tu-dominio>/reservar`. Meta
   rechaza las plantillas que empiezan o terminan en una variable.
5. En `/panel/web`, el WhatsApp de la barbería debe ser **el mismo número** conectado a la API: es al que
   escriben los clientes para confirmar.
6. Programa `GET /api/cron/vencer` cada 5 minutos con la cabecera `Authorization: Bearer <CRON_SECRET>`
   (Vercel Cron, Railway o cron-job.org).

Meta cobra por cada plantilla enviada y da 1.000 mensajes de servicio gratis al mes por número; revisa la
tarifa de Perú en su tabla de precios.

## Créditos

Fotos de ejemplo de Unsplash ([`public/images/CREDITS.md`](public/images/CREDITS.md)) y videos de Mixkit
([`public/videos/CREDITS.md`](public/videos/CREDITS.md)), con licencias que permiten el uso comercial. Son
provisionales hasta tener los de la barbería.
