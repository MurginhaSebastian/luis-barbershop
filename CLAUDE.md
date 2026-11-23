# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Protocolo de Orquestación y Eficiencia de Agentes

Subagentes en `.claude/agents/`: `Explore` (Haiku, solo lectura) y `Coder` (Sonnet, implementa y prueba).

- **Opus (arquitecto y orquestador):** analiza los requerimientos complejos, diseña el plan paso a paso con
  interfaces y contratos exactos y valida el resultado final.
- **Prohibido leer varios archivos directamente con el contexto de Opus:** para inspeccionar el código antes de
  planificar, invoca a `Explore` y pídele solo los fragmentos y firmas exactas que hacen falta.
- **Prohibido escribir bloques largos de código o correr suites pesadas con Opus:** con el plan técnico de un
  paso definido, delega a `Coder` la implementación, las pruebas (Vitest/Playwright) y el commit.
- **Verificación para ahorrar tokens:** prohibido ejecutar `npm run check`, `npm run test:e2e`,
  `npm run test:mutation` o `npm test` completo tras cada cambio. En cada tarea solo `npm run lint` y los
  archivos de prueba creados o tocados (`npx vitest run ruta/del/archivo.test.ts`). La suite completa se corre
  solo al final del proyecto, cuando el usuario lo pida.

Web app para una barbería: reserva de citas, agenda del barbero, catálogo y venta cruzada de productos.
Next.js 16 (App Router) + React 19 + TypeScript estricto + Tailwind 4 + shadcn/ui + Zod 4.

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción (también corre el chequeo de tipos de Next)
npm run lint         # ESLint (flat config, eslint.config.mjs)
npx tsc --noEmit     # solo tipos
npm run check        # lint + tipos + tests + build: solo al final del proyecto, cuando se pida
npm test                                    # Vitest, todos los tests
npx vitest run src/core/core.test.ts -t "availableSlots"   # un archivo / un test
npm run test:coverage  # cobertura de la lógica, con mínimo obligatorio
npm run test:mutation  # rompe reglas críticas a propósito y exige que un test lo detecte
npm run test:e2e     # Playwright + axe contra el build real (necesita Docker encendido)
npx playwright test e2e/booking.spec.ts -g "sin preferencia"   # una prueba de navegador
npm run test:devices # iPhone, iPad, Android, Safari, Firefox y Edge 1920 (capturas en test-results/)
npm run lighthouse -- http://localhost:3200   # sobre `npm run build && npx next start -p 3200`
npm run media:video -- <video> --horizontal|--vertical [--inicio s]   # video de portada (ffmpeg)
```

Al añadir una regla crítica (seguridad, dinero, agenda), añade su mutante en `scripts/mutation-check.mjs`.
Detalle de la batería de calidad en `docs/qa-2026-11.md`.

Pruebas de navegador en `e2e/`: usan Edge (`channel: "msedge"`, sin descargar navegadores), `next start`
en el puerto 3100 y una base aparte, `barbershop_e2e`, que se recrea en cada ejecución.
`e2e/dispositivos.spec.ts` va aparte (`playwright.devices.config.ts`, puerto 3101): WebKit y Firefox de
Playwright (`npx playwright install webkit firefox`, una vez) y Edge para Android. Comprueba diseño, video y
una reserva completa, y guarda capturas para revisarlas; no hay capturas de referencia en el repo.

ESLint no admite avisos (`--max-warnings 0`): reglas recomendadas de `jsx-a11y` y reglas con tipos de
typescript-eslint para promesas (`no-floating-promises`, `no-misused-promises`). Lighthouse falla bajo
85 de rendimiento o 95 en lo demás; el SEO del panel no cuenta (noindex a propósito).

Base de datos (Postgres 17 en Docker, puerto 5433; copiar `.env.example` a `.env`):

```bash
npm run db:up        # levanta Postgres
npm run db:migrate   # aplica migraciones
npm run db:generate  # genera una migración tras cambiar src/infrastructure/db/schema.ts
npm run db:seed      # datos de ejemplo ficticios (idempotente; src/infrastructure/db/seed.sql)
npm run panel:clave  # pide tu clave del panel (Enter = aleatoria) y da las líneas PANEL_* para .env
npm run panel:push   # genera las claves VAPID de los avisos push para .env
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
- Además de la rejilla de `SLOT_STEP_MINUTES`, el final de cada cita o bloqueo es un inicio válido
  ("time-slot packing"): tras una cita de 45 min, la siguiente puede empezar a esa hora si cabe.
- "Sin preferencia" es `barberId: null` en los casos de uso: `findFreeSlotsByBarber` da los huecos de
  cada barbero activo; la reserva asigna al que tiene más huecos ese día y, si otra reserva gana el
  hueco al guardar, prueba con el siguiente.
- Máximo `MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER` citas futuras por celular. La cita guarda
  `customerName` tal como se escribió, porque un celular puede usarlo más de una persona.
- `TimeSlot` es semiabierto `[start, end)`: citas consecutivas no se solapan.
- Qué estados ocupan agenda lo decide `Appointment.blocksSchedule()`, no los repositorios
  (`findByBarberInRange` devuelve citas en cualquier estado): solo `PENDING` y `CONFIRMED`.
- Estados (spec en español → enum): pendiente `PENDING`, confirmada `CONFIRMED`, en riesgo `AT_RISK`,
  atendida `COMPLETED`, cancelada `CANCELLED`, no vino `NO_SHOW`, vencida `EXPIRED`. Las transiciones están en
  `ALLOWED_CHANGES` (`core/entities/appointment.ts`).
- `Appointment.book` decide el estado al nacer: con menos de `BORN_CONFIRMED_UNDER_MINUTES` (120) de antelación,
  `CONFIRMED`; si no, `PENDING`. La antelación mínima es de 5 min, para poder tomar horas en riesgo.
- Reservar sobre una cita `AT_RISK` de otro cliente la desplaza: `save(cita, displacing)` la pasa a `EXPIRED`
  en la misma transacción y, si su cliente confirmó justo antes, falla con `SlotUnavailableError`.
  `CreateAppointmentUseCase` devuelve `{ appointment, displaced }` y la acción avisa a los desplazados.
- `CreateAppointmentUseCase` acepta una hora solo si es uno de los huecos de `findFreeSlots`
  (`application/use-cases/booking/availability.ts`), compartido con `GetAvailableSlotsUseCase`.
  Esa comprobación no es atómica: la garantía real es la restricción `appointments_no_overlap`
  (`EXCLUDE USING gist`, migraciones `0001` y `0009`), y `DrizzleAppointmentRepository.save` y `updateStatus`
  traducen su violación (`23P01`) a `SlotUnavailableError`. Sus estados deben coincidir con `BLOCKING_STATUSES`.
  Toda escritura que pueda entrar en la restricción toma antes el candado del barbero (`lockBarber`).

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
- Logos propios en `public/images/`: `logo.webp` en la cabecera (`app/layout.tsx`) y `logo-sello.webp` en el pie y sobre el formulario de `/panel/entrar`, ambos con `next/image`.
- La marca es `SHOP_NAME` (`core/entities/site.ts`): nunca se escribe a mano. El contacto, la dirección y las redes reales viven solo en `site_settings` (`/panel/web`), jamás en el repo.
- `/privacidad` (`app/privacidad/page.tsx`): política de privacidad (Ley 29733); dirección y WhatsApp salen de `getSiteSettings` en un `<Suspense>`. La enlazan el pie y el paso de datos de la reserva (sin casilla).
- La portada es un video (`HeroVideo`, `public/videos/`, créditos en su `CREDITS.md`): sin sonido, en bucle,
  vertical en el móvil (`<source media>`) y sobre una foto que hace de póster (la subida como "Portada" en el
  panel o un fotograma del video). No arranca solo con movimiento reducido ni ahorro de datos, y siempre lleva
  botón de pausa (WCAG 2.2.2). Los clips salen de `npm run media:video` (ffmpeg): H.264 Main, 10 s,
  `+faststart`, con autocomprobación; sirve igual para el video real del cliente.
- JSON-LD `BarberShop` en la portada: `shopJsonLd` (`presentation/lib/json-ld.ts`) lo arma en `CatalogSections` con los mismos datos que ya lee (contacto, servicios activos, horario) y `jsonLdHtml` escapa `<`.
- Bajo la portada, `ShopFacts`: abierto ahora o cuándo abre (`openingStatus` en `core/scheduling/`, con los
  cierres de toda la barbería; `describeOpening` lo pone en palabras), dirección y precio más bajo.
- SEO: `robots.ts` (bloquea `/panel`, `/api/` y `/reservar`) y `sitemap.ts` (`/` y `/privacidad`) salen de `SITE_URL` (`app/site-url.ts`, leído al compilar), que también es el `metadataBase` del layout.
- La cabecera es fija (`scroll-padding-top` en `globals.css` evita que tape anclas y foco). En el móvil, las
  secciones van en `MobileMenu`, un `<details>` que funciona sin JavaScript.
- Secciones en `src/presentation/components/landing/` (hero, mosaico de servicios, nosotros,
  por qué venir, cómo reservar, productos, testimonios, horario/ubicación, cierre, pie y botón de
  WhatsApp). Los mosaicos enlazan a `/reservar?servicios=<id>`, que solo marca el servicio.
- Con la IA activa (`getAssistantWhatsApp()`, leído en componentes dinámicos bajo `<Suspense>`), todos los botones de
  reservar (cabecera, portada, barra móvil, mosaicos, cierre, pie) van al WhatsApp del asistente (`bookingCta`,
  `BookLink`) y "Cómo reservar" describe esos pasos; `/reservar` queda como plan B (panel "+ Nueva cita" y sin IA). El
  botón flotante sigue siendo el contacto de Luis.
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
- `GetAgendaUseCase` devuelve datos planos (`AgendaItem`): las citas futuras sin confirmar (pendientes y en
  riesgo) de cualquier día y la agenda del día elegido. Qué cambios de estado se permiten lo decide
  `Appointment.changeStatus()`; una cita cancelada no se reabre.
- Acciones de una cita en un solo componente, `AppointmentActions` (`panel/appointment-actions.tsx`, lo usan la ficha
  y la columna lateral): "Confirmar cita" cambia el estado sin abrir nada; "Enviar WhatsApp" es un enlace `wa.me` con
  mensaje (`presentation/lib/whatsapp.ts`: confirmado para `CONFIRMED`, neutro `contactMessage` para el resto);
  "Cancelar" pide confirmación y abre WhatsApp con el aviso (`window.open` antes de cualquier `await`, o el navegador
  lo bloquea). La agenda se refresca sola cada minuto (`AutoRefresh`).
- La agenda es un calendario estilo Apple en dos columnas (`AgendaView`): a la izquierda `AgendaCalendar` (`section`
  `#agenda-dia`), a la derecha `<aside>` "Pendientes / En riesgo" (`PendingColumn`: citas sin confirmar de cualquier día,
  con sus acciones, y al final `PushToggle`); en pantallas pequeñas va debajo. Vistas Día, Semana y Mes (`?vista=&dia=`;
  `GetAgendaUseCase` recibe `{ date, view }`) y barra superior de 52 px (título, ‹ Hoy ›, control Día | Semana | Mes,
  filtro por barbero con `aria-pressed` y "+ Nueva cita"). Día y semana son una grilla de `CAL_PX_PER_MINUTE` por minuto
  (`presentation/lib/timeline.ts`: `gridHours`, `toGrid`, `placeDay`): las citas que se cruzan van en carriles lado a
  lado, con `position: absolute` solo dentro de la grilla; cerrado y bloqueos van sombreados. Con un barbero a la vista
  (elegido en el filtro, que se arma con `Agenda.activeBarbers`, o único barbero activo), la vista Día dibuja los huecos libres (`freeGaps`, un recuadro punteado no interactivo; `AT_RISK` no
  ocupa). Cada cita es un botón: abre su ficha, un `<dialog>` nativo (`AppointmentDialog`) que en escritorio se coloca
  junto a la cita (recortado a la pantalla) y en el móvil es una hoja inferior. Canceladas y vencidas, en una lista bajo
  la vista Día. Paleta dorada monocromática: tokens `--cal-*` y `--status-*` de `globals.css`, sólidos y con el texto por
  encima de 4.5:1 (axe lo vigila); la etiqueta siempre dice el estado en palabras.
- Secciones de administración (`/panel/servicios`, `productos`, `barberos`, `horario`): acciones en
  `app/panel/admin-actions.ts`, formato en `admin-schema.ts` y reglas en `core/catalog/rules.ts`. Los casos de
  uso son `ManageCatalogUseCase` y `ManageScheduleUseCase`. `EditableList` sirve para cualquier lista simple.
- `/panel/chats`: pestaña de solo lectura con las conversaciones de las últimas 24 h del asistente de IA
  (`GetChatsUseCase`, `ChatsView`; la selección es `?c=<celular>`). Solo lo que atiende el asistente de IA: no hay
  nada si usa el básico. Texto plano y enlace a `wa.me` para escribirle al cliente.
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

### Confirmación por WhatsApp
- Al reservar una cita `PENDING`, `BookingConfirmationUseCase.issue` da un código (3 letras + 3 cifras,
  `core/entities/confirmation.ts`) y un plazo (`confirmBy`): 15 min antes de la cita. Solo si WhatsApp está
  configurado (`WHATSAPP_*`); si no, todo sigue como antes y nada queda en riesgo ni vence.
- El enlace de confirmar apunta a `WHATSAPP_DISPLAY_NUMBER` (el número de la API, un chip aparte), **no** a
  `contact.whatsapp`: el de Luis sigue en su app para las consultas, y quien escriba sin código al número
  automático recibe ese contacto.
- El cliente envía "Confirmo mi cita KRT482" con el enlace `wa.me` de la confirmación. `/api/whatsapp` verifica
  la firma de Meta sobre el cuerpo original y `handleMessage` busca el código **junto al número** que escribe
  (el código no es único). Fotos, audios, videos, stickers y documentos llegan como `media` (sin texto): el asistente
  básico les responde el contacto de Luis, el de IA un aviso fijo; reacciones y estados se ignoran. Cada aviso se reclama antes de atenderlo (`HandleIncomingMessageUseCase`,
  `processed_messages`): un repetido de Meta mientras el primero sigue en curso no hace nada. Si el asistente
  falla, se suelta para que Meta reintente.
- `BookingConfirmationUseCase.confirm` y `cancel` los usan también las herramientas del asistente. Confirmar sirve
  desde `PENDING` o `AT_RISK`; si otro tomó la hora, `slot-taken` (SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER) y la
  respuesta enlaza a las horas libres. Cancelar sigue `Appointment.customerCanCancel` (35 min, o sin confirmar);
  "Cancelar KRT482", "no voy"… cancelan (`wantsToCancel`).
- `/api/cron/vencer` (con `CRON_SECRET`, cada 5 min) corre `ConfirmationCycleUseCase`: a -35 min, plantilla
  `recordatorio_cita` con botones de respuesta rápida que devuelven "Confirmo mi cita X" / "Cancelar X" (el
  webhook los recibe como `type: "button"`); a -15 min, `AT_RISK` y aviso push; a su hora, `EXPIRED`. Solo citas
  con código; `reminder_sent_at` se marca antes de enviar y se libera si falla.
- Al cliente desplazado se le envía `cita_vencida` (2 variables: nombre y fecha; el enlace va en un botón fijo,
  porque Meta rechaza plantillas que terminan en variable). `EXPIRED` no ocupa agenda ni se reabre; el panel no
  puede vencer ni poner en riesgo a mano.
- **Todo cambio de estado usa `updateStatus(next, expected)`** (compare-and-set): confirmar, vencer y los
  botones del panel no se pisan entre sí.
- En pruebas, `WHATSAPP_API_URL` apunta a un WhatsApp falso (`e2e/fake-meta.ts`).
- El webhook entrega al puerto `AiAssistantPort` (`application/ports/assistant.ts`) el texto escrito, el
  `payload` de un botón de plantilla (`type: "button"`) o el `id` de un botón o lista interactivos
  (`type: "interactive"`). `selectAssistant` (`infrastructure/assistant/`) elige quién lo atiende: sin
  `AI_PROVIDER`, `BookingConfirmationUseCase` (código y palabras clave); con `AI_PROVIDER=groq` y
  `GROQ_API_KEY`, `GroqAssistant`. Una combinación incompleta avisa una vez y usa el básico, nunca rompe la web.

### Asistente de IA (Groq, `AI_PROVIDER=groq`)
- `GroqAssistant` (`infrastructure/assistant/`) llama por `fetch` a la API compatible con OpenAI de Groq, con
  `AI_MODEL` (por defecto `openai/gpt-oss-120b`; `llama-3.3-70b-versatile` se retiró). Hasta 3 rondas de
  `tool_calls` y una última petición sin herramientas, todo en 12 s. Los códigos ("Confirmo mi cita KRT482", los
  botones del recordatorio) van al asistente básico, sin modelo.
- Contexto: `assistant_messages` (migración 0010), los últimos 6 turnos de las 2 últimas horas por celular, ordenados
  por secuencia, no por hora. Al escribir se borra lo de más de 24 h de cualquier celular: ese historial más largo
  sirve para contar el uso (`countUserTurns`).
- Barreras de ahorro de tokens (límite gratuito de Groq por minuto): el texto del cliente se recorta a 250 caracteres
  antes de guardarlo y mandarlo; `temperature: 0.1` y `max_completion_tokens: 220` (en gpt-oss el razonamiento cuenta
  contra el tope: `finish_reason: "length"` sin texto ni herramientas cae al aviso amable). El prompt lleva el
  catálogo resumido con ids (servicios y barberos activos), así `listar_catalogo_y_mis_citas` queda para ver las
  citas del cliente. Anti-desvío: ante cambios de rol, pedir las instrucciones, programar o temas ajenos, una sola
  frase fija. Multimedia (`IncomingMessage.media`): respuesta fija sin Groq ni historial. Límite por celular de 12
  mensajes por hora y 25 por día, tras el desvío de códigos (estos y los botones del recordatorio ni cuentan ni se
  limitan): respuesta fija con el WhatsApp de Luis, sin Groq ni historial.
- Respuestas fijas sin Groq (`quickReplyKind`, `use-cases/assistant/quick-replies.ts`), en este orden: multimedia →
  código → respuestas fijas → límite → Groq. Saludo solo ("hola", "buenas tardes") y mensaje sin sentido (sin letras
  ni cifras, o una letra suelta) solo cuando no hay conversación en las últimas 2 h: a mitad de una reserva un "👍" o
  un "ok" es un sí y va al modelo. Pedir hablar con una persona o un reclamo ("hablar con Luis", "queja"; "dueño" solo
  con un verbo de contacto) responde `humanHandoffText` con el WhatsApp de Luis, el mismo texto que el prompt
  (regla 6) ordena dar. Se guardan en el historial (Luis las ve en Chats) y cuentan para el límite de 12/25.
- Agrupador de mensajes (`MessageBatcher`, `use-cases/assistant/message-batcher.ts`; `getMessageBatcher()` en el
  contenedor): con la IA activa, los textos escritos (no códigos, botones ni multimedia) de un celular se juntan
  `WHATSAPP_DEBOUNCE_MS` (3500; 0 lo apaga), con tope de 5 mensajes o 10 s desde el primero, y se atienden como un
  solo mensaje (cada texto recortado a 250, y si no cabe se conserva el final). El webhook reclama el mensaje
  (`claim`) y responde 200 antes de atenderlo (`after()`): si el lote falla, Meta ya no reintenta y solo se
  registra. El búfer vive en la memoria del proceso (varias instancias lo partirían).
- Si Groq falla, responde el básico. Si ya reservó, confirmó o canceló, un mensaje fijo con lo hecho; y desde ahí
  un fallo al responder se registra y no se relanza: soltar el mensaje haría que Meta lo repita y podría reservar
  otra hora.
- El alcance (solo la barbería, política de Meta) lo fija el prompt de sistema (`systemPrompt`): ningún código
  impide que el modelo conteste otra cosa. Los `failedNotices` se registran con los 3 últimos dígitos del celular.
- `BotToolExecutor.executeTool(llamada, { verifiedPhone, now })` (`application/use-cases/assistant/`) ejecuta las
  5 herramientas de `bot-tools.ts`: `listar_catalogo_y_mis_citas`, `consultar_huecos_dinamicos`, `reservar_cita`,
  `confirmar_asistencia` y `cancelar_cita`. `botToolDefinitions()` las da en JSON Schema para el LLM.
- **Ningún esquema lleva el celular**: lo pone el servidor (`verifiedPhone`, el remitente firmado por Meta). Lo
  que el modelo mande de más se descarta. Una cita de otro número responde igual que una que no existe.
- `reservar_cita` hace lo mismo que la reserva web: `issue()` si nace pendiente (sin código, el ciclo no la ve),
  aviso push y `notifyReleased` a los desplazados. Los avisos fallidos van en `failedNotices`, no al modelo.
- Sin `appointmentId` y con varias citas, `MULTIPLE_APPOINTMENTS_FOUND`: el modelo pregunta, no adivina. Si otro
  tomó la hora en riesgo, `SLOT_ALREADY_TAKEN_BY_ANOTHER_CUSTOMER` con las 3 siguientes horas libres.
- Esquemas sin `.transform()` (si no, `z.toJSONSchema` falla) y horas como `shopIso` (`…-05:00`), que
  `reservar_cita` acepta tal cual.

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

Barbería en Trujillo (Perú): precios en soles (céntimos enteros), agenda en America/Lima (UTC−5, sin horario
de verano). Varios barberos con un horario de barbería común y bloqueos por barbero (o de toda la
barbería). El cliente reserva sin cuenta (nombre + teléfono, se reconoce por teléfono); una cita
puede llevar varios servicios (se suman duración y precio) y productos que se pagan en el local.
La cita nace `PENDING` (o `CONFIRMED` si faltan menos de 2 h) y ya ocupa el hueco. Inicios cada 30 min y al
terminar cada cita, con antelación mínima y máximo de días configurables en el dominio.

## Git

- Repo propio (`luis-barbershop/.git`), separado del de la carpeta padre `CLAUDECODE/`, y
  **público** en GitHub (`MurginhaSebastian/luis-barbershop`): nada de datos reales (teléfonos,
  direcciones, clientes) en código, seeds ni tests.
- Claude hace los commits: uno por paso, seguido de `git push`, avisando antes en una línea de
  qué incluye. Conventional Commits en español (`feat:`, `chore:`, `refactor:`), sin línea
  `Co-Authored-By`, y con `npm run lint` y las pruebas tocadas en verde antes (ver el protocolo de arriba).
  Docker encendido si esas pruebas usan la base: un test de integración saltado no cuenta como aprobado.
