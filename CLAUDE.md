# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Web app para una barbería: reserva de citas, agenda del barbero, catálogo y venta cruzada de productos.
Next.js 16 (App Router) + React 19 + TypeScript estricto + Tailwind 4 + shadcn/ui + Zod 4.

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción (también corre el chequeo de tipos de Next)
npm run lint         # ESLint (flat config, eslint.config.mjs)
npx tsc --noEmit     # solo tipos
npm run check        # lint + tipos + tests + build: obligatorio antes de cada commit
npm test                                    # Vitest, todos los tests
npx vitest run src/core/core.test.ts -t "availableSlots"   # un archivo / un test
npm run test:coverage  # cobertura de la lógica, con mínimo obligatorio
npm run test:mutation  # rompe reglas críticas a propósito y exige que un test lo detecte
npm run test:e2e     # Playwright + axe contra el build real (necesita Docker encendido)
npx playwright test e2e/booking.spec.ts -g "sin preferencia"   # una prueba de navegador
```

Al añadir una regla crítica (seguridad, dinero, agenda), añade su mutante en `scripts/mutation-check.mjs`.
Detalle de la batería de calidad en `docs/qa-2026-11.md`.

Pruebas de navegador en `e2e/`: usan Edge (`channel: "msedge"`, sin descargar navegadores), `next start`
en el puerto 3100 y una base aparte, `barbershop_e2e`, que se recrea en cada ejecución.

Base de datos (Postgres 17 en Docker, puerto 5433; copiar `.env.example` a `.env`):

```bash
npm run db:up        # levanta Postgres
npm run db:migrate   # aplica migraciones
npm run db:generate  # genera una migración tras cambiar src/infrastructure/db/schema.ts
npm run db:seed      # datos de ejemplo ficticios (idempotente; src/infrastructure/db/seed.sql)
npm run panel:clave  # genera la clave del panel y las líneas PANEL_* para .env
```

Los tests viven junto al código (`*.test.ts`). `repositories.test.ts` usa una base aparte,
`barbershop_test` (la crea, la migra y la vacía en cada test), y se salta si no hay `DATABASE_URL`. Los de casos de uso usan repositorios falsos en
memoria definidos en el propio test y un reloj fijo (`now: () => Date` se inyecta en los deps).

## Arquitectura: Clean Architecture

Las dependencias solo apuntan hacia dentro: `app → presentation → application → core`, e
`infrastructure → application → core`.

- `src/core/`: entidades, Value Objects y errores de dominio. TypeScript puro, **cero imports**
  de Next, React, Zod, ORM o cualquier paquete.
- `src/application/`: casos de uso (`use-cases/<módulo>/`) y puertos (`ports/repositories/`,
  interfaces tipo `IAppointmentRepository`). Los casos de uso reciben los puertos por
  constructor; nunca importan nada de `infrastructure/`.
- `src/infrastructure/`: implementaciones concretas (PostgreSQL + ORM en `db/`, repositorios
  en `db/repositories/`, WhatsApp/notificaciones).
- `src/presentation/`: UI (shadcn + Tailwind), hooks y estado cliente.
- `src/app/`: rutas de Next. Route Handlers y Server Actions son solo adaptadores de entrada:
  validan con Zod, construyen el caso de uso con sus repositorios concretos y lo llaman. Sin
  lógica de negocio aquí.

`eslint.config.mjs` hace cumplir la dirección de dependencias con `no-restricted-imports` por capa:
si `npm run lint` se queja de un import entre capas, se corrige el diseño, no la regla.

### Reservas
- Toda la lógica de agenda es pura y vive en `src/core/scheduling/`: `availableSlots` genera los
  inicios (cada `SLOT_STEP_MINUTES` desde la apertura de cada tramo) y descarta los que no caben,
  pisan algo ocupado o caen fuera de la ventana; las constantes del negocio están en
  `booking-policy.ts`. Las fechas de día son `"YYYY-MM-DD"` locales y los horarios, minutos desde
  medianoche local; `shopDayRange`/`shopDateOf` convierten a instantes UTC.
- "Sin preferencia" es `barberId: null` en los casos de uso: `findFreeSlotsByBarber` da los huecos de
  cada barbero activo; la reserva asigna al que tiene más huecos ese día y, si otra reserva gana el
  hueco al guardar, prueba con el siguiente.
- Máximo `MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER` citas futuras por celular. La cita guarda
  `customerName` tal como se escribió, porque un celular puede usarlo más de una persona.
- `TimeSlot` es semiabierto `[start, end)`: citas consecutivas no se solapan.
- Qué estados ocupan agenda lo decide `Appointment.blocksSchedule()`, no los repositorios
  (`findByBarberInRange` devuelve citas en cualquier estado).
- `CreateAppointmentUseCase` acepta una hora solo si es uno de los huecos de `findFreeSlots`
  (`application/use-cases/booking/availability.ts`), compartido con `GetAvailableSlotsUseCase`.
  Esa comprobación no es atómica: la garantía real es la restricción `appointments_no_overlap`
  (`EXCLUDE USING gist`, migración `0001`), y `DrizzleAppointmentRepository.save` traduce su
  violación (`23P01`) a `SlotUnavailableError`. Sus estados deben coincidir con `BLOCKING_STATUSES`.

### Web (Next 16 con `cacheComponents: true`)
- `src/infrastructure/container.ts` (`getUseCases()`) es la raíz de composición: el único sitio
  donde los casos de uso reciben repositorios concretos. `app/` lo llama; `presentation/` no
  (recibe datos y la Server Action por props; ESLint lo impide).
- Toda lectura de base o de `searchParams` va en un componente dentro de `<Suspense>`; si no
  depende de la petición, empieza con `await connection()`. Así el build no toca la base y las
  páginas quedan como Partial Prerender (armazón estático + datos en streaming).
- La reserva es un flujo de 4 pasos cuyo estado vive en la URL
  (`/reservar?paso=N&servicios=…&barbero=<uuid|cualquiera>&dia=…&hora=…`): el botón Atrás funciona y
  recargar no pierde nada. `parseBookingQuery` (`booking-schema.ts`) lee la URL campo a campo,
  `resolveStep` y `bookingHref` (`presentation/lib/booking-flow.ts`) deciden el paso y arman los enlaces;
  un paso sin sus datos cae en el primero incompleto. Cada paso es un componente en
  `presentation/components/booking/` sobre `StepLayout`.
- `StepLayout` mueve el foco al título al montarse. Los pasos que son componentes de servidor necesitan
  `key` propia: sin ella React reutiliza la plantilla y el foco no se mueve.
- La Server Action pública es `createAppointmentAction` (`app/reservar/actions.ts`): valida con Zod
  (`booking-schema.ts`, frontera de confianza) y traduce `DomainError` a mensajes; cualquier otro error
  se registra y se responde genérico. Los mensajes de `DomainError` los lee el cliente: sin ids internos.
- Cabeceras de seguridad en `next.config.ts`, solo en producción. `script-src` lleva `'unsafe-inline'`
  porque las páginas prerenderizadas no admiten nonce.
- Tema: tokens de shadcn redefinidos en el bloque `.dark` de `globals.css` (`<html class="dark">`);
  tipografías Bodoni Moda (`font-heading`) y Manrope. Fechas y horas siempre con
  `presentation/lib/format.ts` (zona America/Lima).

### Landing (portada)
- Secciones en `src/presentation/components/landing/` (hero, mosaico de servicios, nosotros,
  por qué venir, cómo reservar, productos, testimonios, horario/ubicación, cierre, pie y botón de
  WhatsApp). Los mosaicos enlazan a `/reservar?servicios=<id>`, que solo marca el servicio.
- Contacto, secciones visibles y fotos de la portada viven en la tabla `site_settings` (una fila JSON),
  editables en `/panel/web`. `readSiteSettings` (`core/entities/site.ts`) lee lo guardado sin fiarse y
  completa con `DEFAULT_SITE_SETTINGS`; los enlaces solo admiten `https:`. Nunca en el código: el repo es
  público. `getSiteSettings` (`app/site-settings.ts`) hace una sola lectura por petición, aunque la pidan
  la cabecera, la portada y el pie.
- Las secciones llegan en streaming, después del salto del navegador a un `#ancla`: `ScrollToHash` lo
  repite al final de `CatalogSections`.
- Fotos provisionales de Unsplash en `public/images/` (créditos en `CREDITS.md`). Se sustituyen por las que
  se suban en `/panel/web`; sin foto subida, cada servicio usa la que elige `photoFor` por su nombre.
- Testimonios en `presentation/content/testimonials.ts`: solo reales y con permiso; vacío = sección
  oculta.

### Panel del barbero (`/panel`)
- Una sola clave para la barbería: hash `scrypt` en `PANEL_PASSWORD_HASH`, sesión sin estado firmada con
  `PANEL_SESSION_SECRET` (12 h, cookie `httpOnly`). Sin esas variables el panel no deja entrar a nadie.
  Código en `infrastructure/auth/`; las cookies en `app/panel/session.ts`.
- **`requirePanelSession()` va en cada página y en cada Server Action del panel**: proteger la página no
  protege sus acciones. La sesión se comprueba tras `connection()`, porque compara con la hora actual.
- `GetAgendaUseCase` devuelve datos planos (`AgendaItem`): las citas futuras sin confirmar de cualquier
  día y la agenda del día elegido. Qué cambios de estado se permiten lo decide
  `Appointment.changeStatus()`; una cita cancelada no se reabre.
- Confirmar y cancelar abren WhatsApp con el mensaje escrito (`presentation/lib/whatsapp.ts`). El
  `window.open` va antes de cualquier `await`, o el navegador lo bloquea. La agenda se refresca sola cada
  minuto (`AutoRefresh`).
- Secciones de administración (`/panel/servicios`, `productos`, `barberos`, `horario`): acciones en
  `app/panel/admin-actions.ts`, formato en `admin-schema.ts` y reglas en `core/catalog/rules.ts`. Los casos de
  uso son `ManageCatalogUseCase` y `ManageScheduleUseCase`. `EditableList` sirve para cualquier lista simple.
- Nada con citas se borra: servicios, productos y barberos solo se ocultan (`active: false`). Editar un
  precio no toca citas existentes, porque guardan su foto de precio.
- Ocultar un barbero o bloquear un periodo nunca cancela citas: la acción devuelve un `warning` con cuántas
  quedan afectadas y el barbero decide en la agenda.
- `next build` vacía `.next/`: no dejes ahí nada que quieras conservar.
- La agenda (`/panel`) lleva `PushToggle`: activar, probar y desactivar los avisos en ese dispositivo.
- El freno de intentos (`LoginThrottle`) vive en memoria del proceso: revisar si la web pasa a varias
  instancias, y qué cabecera de IP es de fiar en el hosting.

### Fotos subidas
- `ManageSiteUseCase` comprueba el tipo por contenido (`core/entities/image.ts`: JPEG, PNG, WebP, 5 MB) y
  `SharpImageOptimizer` la deja en WebP de 1600 px como máximo, sin metadatos (pueden llevar la ubicación).
- `selectImageStorage` elige dónde guardar: Supabase Storage por su API REST si están `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca `NEXT_PUBLIC_`) y `SUPABASE_BUCKET`; si no, disco local
  (`.uploads/`, servido en `/imagenes/[archivo]`) fuera de producción o con `IMAGE_STORAGE=local`. En
  producción sin Supabase la subida se desactiva, porque el disco del hosting no conserva archivos.
- El disco local solo acepta nombres `<uuid>.webp` generados por nosotros: impide salir de la carpeta.
- `next.config.ts` admite en `next/image` solo el host de `SUPABASE_URL` (leído al compilar).

### Avisos push
- Al reservar, `createAppointmentAction` llama a `ManagePushUseCase.notifyNewBooking` dentro de `after()`: el
  cliente no espera y un aviso fallido solo se registra. El mensaje nunca lleva el celular del cliente.
- `WebPushSender` (`infrastructure/push/`) cifra con `web-push` y entrega por `fetch`; un 404 o 410 borra el
  dispositivo y cualquier otro fallo solo se cuenta. Claves VAPID en `VAPID_*` (`npm run panel:push`): sin
  ellas el panel explica que faltan y no se envía nada. Cambiarlas obliga a reactivar cada dispositivo.
- `public/sw.js` muestra el aviso, abre o enfoca `/panel` y manda un mensaje a las pestañas abiertas, que
  `AutoRefresh` usa para refrescar al momento. Se registra con `scope: "/panel"`.
- `public/panel.webmanifest` solo se enlaza desde el layout del panel: en iPhone los avisos exigen instalar
  el panel en la pantalla de inicio. Probar en local funciona en `localhost`; en un celular, solo con HTTPS.
- En las pruebas de navegador no hay servicio de push: se simula la suscripción y el aviso se entrega por
  CDP (`ServiceWorker.deliverPushMessage`).

### Persistencia (Drizzle)
- Esquema en `src/infrastructure/db/schema.ts`; migraciones SQL versionadas en `db/migrations/`.
  Lo que Drizzle no modela (EXCLUDE, extensiones) va en migraciones `--custom` escritas a mano.
- `getDb()` (`db/client.ts`) crea el pool al primer uso para que `next build` no necesite base.
- Las líneas de servicios y productos de una cita son fotos (nombre, duración, precio) y se
  reemplazan enteras en cada `save`, dentro de una transacción.
- Supabase se configurará más adelante: solo cambiará `DATABASE_URL`.

## shadcn/ui

`components.json` está redirigido a la capa de presentación: `npx shadcn@latest add <componente>`
escribe en `src/presentation/components/ui/`, y `cn` vive en `src/presentation/lib/utils.ts`.
No recrear `src/components` ni `src/lib`. El estilo es `base-nova` (primitivos de `@base-ui/react`,
no Radix) y `cn` viene del paquete `cn` de shadcn, que sustituye a `clsx` + `tailwind-merge`.

## Negocio

Barbería en Perú: precios en soles (céntimos enteros), agenda en America/Lima (UTC−5, sin horario
de verano). Varios barberos con un horario de barbería común y bloqueos por barbero (o de toda la
barbería). El cliente reserva sin cuenta (nombre + teléfono, se reconoce por teléfono); una cita
puede llevar varios servicios (se suman duración y precio) y productos que se pagan en el local.
La cita nace `PENDING` y ya ocupa el hueco. Inicios cada 30 min, con antelación mínima y máximo de
días configurables en el dominio.

## Git

- Repo propio (`luis-barbershop/.git`), separado del de la carpeta padre `CLAUDECODE/`, y
  **público** en GitHub (`MurginhaSebastian/luis-barbershop`): nada de datos reales (teléfonos,
  direcciones, clientes) en código, seeds ni tests.
- Claude hace los commits: uno por paso, seguido de `git push`, avisando antes en una línea de
  qué incluye. Conventional Commits en español (`feat:`, `chore:`, `refactor:`), sin línea
  `Co-Authored-By`, y con `npm run check` en verde antes. Docker encendido: un test de integración
  saltado no cuenta como aprobado.
