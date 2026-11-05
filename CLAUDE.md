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
npm run test:e2e     # Playwright + axe contra el build real (necesita Docker encendido)
npx playwright test e2e/booking.spec.ts -g "sin preferencia"   # una prueba de navegador
```

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
- La única Server Action es `createAppointmentAction` (`app/reservar/actions.ts`): valida con Zod
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
- Contacto del negocio (WhatsApp, dirección, Maps, redes, Libro de Reclamaciones) en variables
  `SHOP_*` de `.env` (ver `.env.example`), leídas y validadas por
  `infrastructure/config/shop-contact.ts`: lo que falte o sea inválido no se muestra. Nunca en el
  código, el repo es público. Parte de la página se genera al compilar: tras cambiarlos hay que volver
  a hacer `npm run build`, o la web mezcla valores viejos y nuevos.
- Las secciones llegan en streaming, después del salto del navegador a un `#ancla`: `ScrollToHash` lo
  repite al final de `CatalogSections`.
- Fotos provisionales de Unsplash en `public/images/` (créditos en `CREDITS.md`); la foto de cada
  servicio se elige por su nombre en `service-gallery.tsx` hasta que haya fotos reales.
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
- El freno de intentos (`LoginThrottle`) vive en memoria del proceso: revisar si la web pasa a varias
  instancias, y qué cabecera de IP es de fiar en el hosting.

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
