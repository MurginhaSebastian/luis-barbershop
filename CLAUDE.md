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
npm test                                    # Vitest, todos los tests
npx vitest run src/core/core.test.ts -t "availableSlots"   # un archivo / un test
```

Base de datos (Postgres 17 en Docker, puerto 5433; copiar `.env.example` a `.env`):

```bash
npm run db:up        # levanta Postgres
npm run db:migrate   # aplica migraciones
npm run db:generate  # genera una migración tras cambiar src/infrastructure/db/schema.ts
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
- `TimeSlot` es semiabierto `[start, end)`: citas consecutivas no se solapan.
- Qué estados ocupan agenda lo decide `Appointment.blocksSchedule()`, no los repositorios
  (`findByBarberInRange` devuelve citas en cualquier estado).
- `CreateAppointmentUseCase` acepta una hora solo si es uno de los huecos de `findFreeSlots`
  (`application/use-cases/booking/availability.ts`), compartido con `GetAvailableSlotsUseCase`.
  Esa comprobación no es atómica: la garantía real es la restricción `appointments_no_overlap`
  (`EXCLUDE USING gist`, migración `0001`), y `DrizzleAppointmentRepository.save` traduce su
  violación (`23P01`) a `SlotUnavailableError`. Sus estados deben coincidir con `BLOCKING_STATUSES`.

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
  `Co-Authored-By`, y con `npm run lint`, `npx tsc --noEmit` y `npm run build` en verde antes.
