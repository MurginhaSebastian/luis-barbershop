# Luis Barbershop

Web de una barbería en Lima: los clientes reservan su hora en línea y el barbero lleva la agenda, el catálogo y
la web desde un panel propio. Precios en soles, horario de Lima.

## Qué hace

**Para el cliente**
- Portada con video, servicios con precio y duración, horario, ubicación y un aviso de si está abierto ahora.
- Reserva en 4 pasos, sin cuenta: servicios (uno o varios), barbero o "sin preferencia", día y hora libres,
  nombre y celular. Puede sumar productos para recogerlos en el local.
- Botón de WhatsApp y enlaces a redes, si la barbería los configura.

**Para el barbero** (`/panel`, con una clave)
- Agenda del día y citas por confirmar; confirmar o cancelar abre WhatsApp con el mensaje escrito.
- Aviso push en el celular o la PC en cuanto alguien reserva.
- Servicios, productos, barberos, horario y bloqueos (feriados, vacaciones). Nada con citas se borra:
  se oculta.
- La web: contacto, secciones visibles y fotos (se reducen y pierden los datos de ubicación al subirlas).

## Tecnología

Next.js 16 (App Router, Partial Prerender) · React 19 · TypeScript estricto · Tailwind CSS 4 · shadcn/ui ·
Zod 4 · PostgreSQL 17 + Drizzle · Web Push (VAPID) · Vitest · Playwright + axe · Lighthouse.

Organizada en **Clean Architecture**. Las dependencias solo apuntan hacia dentro y ESLint lo hace cumplir:

```
app (rutas, Server Actions)  ──►  presentation (UI)  ──►  application (casos de uso, puertos)  ──►  core (dominio)
                                  infrastructure (Postgres, push, fotos)  ──►  application
```

| Carpeta | Contenido |
|---|---|
| `src/core/` | Entidades, reglas y agenda (huecos libres, apertura). TypeScript puro, sin librerías. |
| `src/application/` | Casos de uso y puertos (interfaces de repositorios, avisos, fotos). |
| `src/infrastructure/` | Postgres/Drizzle, Web Push, almacenamiento de fotos, sesión del panel. `container.ts` lo monta todo. |
| `src/presentation/` | Componentes (portada, reserva, panel) y utilidades de formato. |
| `src/app/` | Páginas y Server Actions: validan con Zod y llaman al caso de uso. |
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

- **Lógica:** 340 pruebas, cobertura mínima del 90 % de líneas y 39 mutantes de reglas críticas (agenda,
  dinero, sesión, enlaces, fotos, avisos), todos detectados.
- **Navegador:** reserva, panel, accesibilidad con axe, teclado, cabeceras de seguridad, y 7 dispositivos
  emulados en los tres motores.
- **Lighthouse** (noviembre 2026): 95–100 en rendimiento y 100 en accesibilidad, buenas prácticas y SEO.
  El panel tiene SEO bajo a propósito: no debe aparecer en buscadores.
- Detalle en [`docs/qa-2026-11.md`](docs/qa-2026-11.md) y [`docs/auditoria-2026-11.md`](docs/auditoria-2026-11.md).

## Antes de publicar

1. Base de datos en el hosting (o Supabase) y `npm run db:migrate` contra ella.
2. `PANEL_*` y `VAPID_*` **nuevas** para producción, no las de desarrollo.
3. Fotos: `SUPABASE_*` disponibles al compilar y al ejecutar.
4. HTTPS: sin él no hay avisos push en el celular.
5. Video real de la barbería con `npm run media:video` y testimonios reales con permiso.

## Créditos

Fotos de ejemplo de Unsplash ([`public/images/CREDITS.md`](public/images/CREDITS.md)) y videos de Mixkit
([`public/videos/CREDITS.md`](public/videos/CREDITS.md)), con licencias que permiten el uso comercial. Son
provisionales hasta tener los de la barbería.
