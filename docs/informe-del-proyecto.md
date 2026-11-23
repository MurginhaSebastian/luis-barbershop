# D'luiss Barber Shop: informe del proyecto

Documento para entender qué se ha construido, qué se pidió, cómo está hecho y qué falta, pensado para
consultarlo con un experto. Estado al **19 de noviembre de 2026**.

---

## 1. Resumen en una página

**Qué es.** Una web para una barbería en Trujillo (Perú):
- los clientes reservan su hora en línea, sin crear cuenta;
- el barbero (Luis) gestiona su agenda, su catálogo y la propia web desde un panel privado.

**Estado.**
- Funciona completa en local (en el PC de desarrollo), con 216 commits en GitHub.
- **Aún no está publicada en internet**: no tiene hosting, dominio ni HTTPS.
- Las integraciones externas (WhatsApp de Meta, Supabase, avisos en celulares reales) están programadas y
  probadas con simulaciones, pero **no con los servicios reales**.

**Repositorio.** `github.com/MurginhaSebastian/luis-barbershop`. Es **público**, por lo que no contiene
datos reales (teléfonos, direcciones, clientes) ni contraseñas.

**Calidad medida.**

| Prueba | Resultado |
|---|---|
| Lógica (unitarias e integración) | 601 en 45 archivos, todas pasan (21 de noviembre) |
| Navegador | 230 pasadas, 0 fallidas y 4 omitidas de 234 (21 de noviembre; las omitidas son los `test.skip` por proyecto de `site.spec.ts`) |
| Errores sembrados a propósito | 73 de 73 detectados (21 de noviembre; la corrida completa dio 72 porque el texto de un mutante había quedado desfasado, se corrigió y se comprobó a mano contra su prueba) |
| Cobertura de la lógica | 96,2 % de sentencias, 90,5 % de ramas, 96,76 % de funciones y 97,3 % de líneas (21 de noviembre) |
| Lighthouse | Accesibilidad y buenas prácticas 100 en las 10 mediciones; rendimiento 91–100 (21 de noviembre; ver tabla en la sección de pruebas) |
| Dispositivos emulados | 7: 25 pruebas pasadas, 0 fallidas y 3 omitidas de 28 (21 de noviembre) |

---

## 2. Alcance pedido (en orden cronológico)

Lo que se fue pidiendo durante el proyecto, en resumen:

1. **Base técnica.** Arquitectura limpia (Clean Architecture) con separación estricta de capas, trabajo por
   fases y un commit por paso.
2. **Negocio.**
   - Una barbería con varios barberos y un horario común.
   - Reserva sin cuenta (nombre + celular).
   - Varios servicios por cita y productos para recoger en el local.
   - Precios en soles y agenda en hora de Lima.
3. **Portada (landing).** Inspirada en montalvoformen.com.pe, con estilo oscuro clásico.
4. **Reserva más intuitiva.** Paso a paso, con opción "sin preferencia" de barbero.
5. **Panel del barbero.**
   - Agenda.
   - Confirmar y cancelar avisando por WhatsApp.
6. **Administración desde el panel.**
   - Servicios, productos, barberos, horarios y bloqueos (feriados).
   - Contacto, secciones visibles de la web y fotos.
7. **Avisos push en tiempo real** al barbero cuando alguien reserva.
8. **Calidad.** Pruebas unitarias, QA, auditoría, pruebas en distintos dispositivos, Lighthouse y ESLint
   estricto.
9. **Rediseño de portada.**
   - Video de un barbero trabajando.
   - Se quitó el poste giratorio.
   - Interfaz más intuitiva (cabecera fija, menú en el móvil, barra "Hoy / Dónde / Precios").
10. **Automatización por WhatsApp.**
    - El cliente confirma su cita por WhatsApp, desde un número aparte del de Luis.
    - Más adelante, un asistente con IA.
11. **Material para el cliente.** Preguntas para el barbero y una propuesta en texto.
12. **Agenda dinámica y liberación condicional** (hecho el 15–16 de noviembre).
    - La cita dura la suma exacta de sus servicios y la siguiente puede empezar justo al terminar.
    - Con menos de 2 h de antelación la cita nace confirmada.
    - A los 35 min se pide confirmar; a los 15, si no respondió, la cita queda "en riesgo" y otro cliente puede
      tomar la hora; a su hora, vence.
    - El cliente puede cancelar por WhatsApp con 35 min de antelación.
13. **Preparación del asistente con IA y agenda nueva** (hecho el 16 de noviembre).
    - Cinco herramientas listas para que una IA consulte, reserve, confirme y cancele, sin conectar aún a
      ningún proveedor.
    - WhatsApp entiende también los botones y listas de mensajes interactivos.
    - En el panel, la agenda del día es una línea de tiempo proporcional, con colores por estado y filtro por
      barbero.
14. **Asistente con IA conectado a Groq** (hecho el 16 de noviembre). Falta solo la clave de Groq para activarlo.
    - Recuerda la conversación reciente; cada mensaje se atiende una sola vez.
    - Los huecos "Libre" del panel respetan el horario y los bloqueos.
15. **Ahorro de tokens y límites del asistente** (hecho entre el 17 y el 19 de noviembre). Texto recortado,
    historial más corto, multimedia sin IA y tope de mensajes por celular, para no agotar el límite gratuito
    de Groq.
16. **Portada directa al WhatsApp del asistente** (19 de noviembre). Con la IA activa, reservar es escribirle.
17. **Panel renovado** (19 de noviembre). Calendario y pendientes en dos columnas, barra superior compacta,
    ficha de la cita junto a ella y acciones unificadas.

---

## 3. Qué hace hoy la web

### Para el cliente
- **Portada.** Video de fondo (con botón de pausa) y servicios con precio y duración. También muestra si la
  barbería está abierta ahora o cuándo abre (descontando feriados), la dirección, el horario y un botón de
  WhatsApp.
  - **Con el asistente de IA activo**, todos los botones de reservar (cabecera, portada, barra móvil, cierre,
    pie y cada servicio, que escribe su nombre en el mensaje) abren el WhatsApp del asistente, y "Cómo
    reservar" explica los pasos por WhatsApp. El botón flotante de Luis se mantiene y su mensaje es "Hola,
    tengo una consulta."
  - Sin IA, los botones llevan a la reserva web.
- **Reserva en 4 pasos** (con la IA activa queda como plan B; el panel la usa en "+ Nueva cita"). Servicios → barbero (o "sin preferencia") → día y hora libres → nombre y celular.
  - El estado vive en la dirección web: el botón "Atrás" funciona y recargar no pierde nada.
  - La cita dura la suma de sus servicios (corte 30 + cejas 15 = 45 min). Además de las horas en punto y
    media, se ofrece empezar justo cuando termina otra cita, para no dejar huecos muertos.
  - Se puede reservar hasta con 5 minutos de antelación.
- **Si faltan menos de 2 horas, la cita nace confirmada**: no hay tiempo de pedir confirmación.
- **Si reserva con más antelación, confirma por WhatsApp** (si está configurado).
  - Tras reservar ve un código (p. ej. `KRT482`) y un botón que abre WhatsApp con el mensaje escrito.
  - 35 minutos antes recibe un recordatorio con dos botones: "Sí, voy" y "No podré ir".
  - Si a los 15 minutos aún no respondió, su cita queda **en riesgo**: sigue siendo suya y puede confirmarla,
    pero otro cliente ya puede reservar esa hora. Si alguien la toma, al primero se le avisa.
  - Si llega su hora y nadie confirmó, la cita vence.
- **Cancelar por WhatsApp** ("Cancelar KRT482", "no puedo ir"): con 35 minutos o más de antelación, o al
  responder que no irá al recordatorio. Una cita confirmada con menos de 35 minutos no se cancela sola: se le
  pide avisar a la barbería.

### Para el barbero (panel privado en `/panel`)
- **Agenda en dos columnas.** A la izquierda el calendario (vistas Día, Semana y Mes); al lado, "Pendientes /
  En riesgo" de cualquier día, con el plazo de cada una. En el móvil la columna va debajo, con el interruptor
  de avisos al final.
  - **Barra superior de 52 px:** fecha, ‹ › Hoy, Día · Semana · Mes, filtro de barbero y "+ Nueva cita".
    El título de la vista Día siempre lleva la fecha, también hoy.
  - Cada cita mide según su duración y se rotula "17:00 Nombre · Reservado"; las que se cruzan van lado a
    lado. Colores por estado, siempre con el estado escrito. Canceladas y vencidas van aparte, debajo.
  - **Huecos libres discretos**, solo cuando se ve un solo barbero (el filtro usa los barberos activos).
  - **Ficha de la cita:** en escritorio se abre junto a la cita (en la vista Día puede taparla); en el móvil,
    como hoja inferior.
- **Acciones de la ficha** (las mismas en la agenda y en pendientes):
  - **Confirmar cita:** cambia el estado sin abrir WhatsApp.
  - **Enviar WhatsApp:** mensaje neutro si la cita aún no está confirmada.
  - **Cancelar:** pide confirmación y abre WhatsApp con el aviso (a propósito).
  - **Atendida** y **No vino**.
- **Avisos push** en el celular o la PC cuando alguien reserva, confirma o cancela, y cuando una cita queda
  en riesgo.
- **Administración.**
  - Servicios, productos y barberos. Nada con citas se borra: se oculta.
  - Horario semanal y bloqueos (feriados, vacaciones). Avisa si quedan citas afectadas, sin cancelarlas.
  - La web: contacto, secciones visibles y fotos. Las fotos se reducen y se les quitan los datos de ubicación.

---

## 4. Cómo está hecho

### 4.1 Tecnología

| Pieza | Versión | Para qué |
|---|---|---|
| Next.js (App Router) | 16.4.3 | Marco web: páginas, servidor y acciones |
| React | 19.3 | Interfaz |
| TypeScript (estricto) | 5 | Lenguaje, con tipos |
| Tailwind CSS + shadcn/ui | 4 | Estilos y componentes |
| Zod | 4.6 | Validación de todo lo que entra |
| PostgreSQL + Drizzle ORM | 17 / 0.45 | Base de datos y acceso a ella |
| web-push | 3.6.7 | Avisos push (estándar VAPID) |
| sharp | 0.35 | Procesar fotos subidas |
| WhatsApp Cloud API (Meta) | Graph v27.0 | Confirmación por WhatsApp |
| Vitest, Playwright, axe, Lighthouse | | Pruebas y medición |
| ffmpeg | 9.0 | Preparar el video de portada |
| Docker | | Base de datos local |

### 4.2 Arquitectura (Clean Architecture)

El código está en capas. Cada capa solo depende de las de dentro, y la herramienta ESLint lo hace cumplir:
si alguien rompe la regla, el proyecto no pasa la revisión.

```
src/app/            Rutas web y "Server Actions": reciben la petición, validan con Zod, llaman a un caso de uso
   │
src/presentation/   Componentes visuales (portada, reserva, panel). No tocan la base de datos.
   │
src/application/    Casos de uso (reservar, confirmar, cancelar, ciclo de confirmaciones, administrar…)
                    y "puertos" (interfaces)
   │
src/core/           Reglas del negocio puras: agenda, huecos libres, estados de una cita, plazos.
                    Sin ninguna librería: TypeScript puro.

src/infrastructure/ Implementaciones concretas de los puertos: Postgres, WhatsApp, push, fotos, sesión.
                    container.ts es el único lugar donde se conecta todo.
```

**Por qué así.** Las reglas del negocio no dependen de la base de datos ni del proveedor externo. Cambiar
Postgres por Supabase, o Groq por Claude en la IA, solo toca `infrastructure/`.

### 4.3 Base de datos (13 tablas, 10 migraciones)

| Tabla | Contenido |
|---|---|
| `barbers`, `services`, `products` | Catálogo (se ocultan, no se borran) |
| `customers` | Clientes, identificados por celular |
| `business_hours`, `schedule_blocks` | Horario semanal y bloqueos (por barbero o de toda la barbería) |
| `appointments` | Citas, con cuándo se confirmaron y cuándo se envió el recordatorio. Una **restricción anti-solape** en la base impide dos citas pendientes o confirmadas a la misma hora del mismo barbero |
| `appointment_services`, `appointment_products` | Copia de nombre y precio al reservar: cambiar un precio no altera citas existentes |
| `site_settings` | Contacto, secciones visibles y fotos de la web (una fila JSON) |
| `push_subscriptions` | Dispositivos del barbero que reciben avisos |
| `booking_confirmations` | Código para confirmar cada cita por WhatsApp y hasta cuándo (15 min antes) |
| `processed_messages` | Mensajes de WhatsApp ya atendidos (Meta puede repetirlos) |

### 4.4 Reglas de negocio clave

- **Horarios en hora de Lima** (UTC−5, sin horario de verano).
- **Reservas.**
  - Inicios cada 30 minutos y justo al terminar cada cita o bloqueo.
  - Mínimo 5 minutos de antelación y máximo 14 días.
  - Máximo 2 citas futuras por celular (las que están en riesgo no cuentan).
- **Estado al nacer.** Con menos de 2 h de antelación, "confirmada"; si no, "pendiente". Las dos ocupan su
  hueco.
- **Estados:** pendiente, confirmada, en riesgo, atendida, cancelada, no vino y vencida.
  - **Solo pendiente y confirmada ocupan agenda.** En riesgo, atendida, cancelada, no vino y vencida dejan
    la hora libre para otros.
  - Las vencidas y canceladas no se reabren.
  - En el código los estados van en inglés (`PENDING`, `CONFIRMED`, `AT_RISK`, `COMPLETED`, `CANCELLED`,
    `NO_SHOW`, `EXPIRED`).
- **Tiempos antes de la cita** (una tarea cada 5 minutos):
  - −35 min: recordatorio por WhatsApp con botones, una sola vez por cita.
  - −15 min: si sigue pendiente, pasa a "en riesgo" y se avisa al barbero.
  - 0 min: si sigue en riesgo, vence.
- **Tomar una hora en riesgo.** Quien reserva sobre ella la gana: la cita anterior vence en la misma
  operación y a su cliente se le avisa. Si ese cliente confirmó un instante antes, la reserva nueva falla y se
  le ofrece otra hora. Con "sin preferencia", primero se busca un barbero libre sin desplazar a nadie.
- **Dos personas no pueden quedarse con la misma hora**, ni pulsando a la vez: lo garantiza la base de
  datos, no solo el código.
- **Todo cambio de estado es condicional** ("cámbiala solo si sigue como la leí"). Si un cliente confirma
  justo cuando su cita vence, o el barbero la cambia a la vez, ninguno pisa al otro.
- **Confirmación por WhatsApp.**
  - Se puede confirmar estando pendiente o en riesgo ("salvado por la campana"), si nadie tomó la hora.
  - El código se acepta solo desde el mismo celular que reservó.
- **Cancelación por el cliente:** con 35 min o más de antelación; con menos, solo si aún no había
  confirmado.

### 4.5 Seguridad

- **Panel con una sola clave para la barbería.**
  - Se guarda cifrada (scrypt). La sesión dura 12 h, firmada, en una cookie no accesible desde JavaScript.
  - Tras varios intentos fallidos, frena nuevos intentos.
- **Cada acción del panel comprueba la sesión por separado**: proteger la página no basta.
- **Toda entrada se valida con Zod.** Los enlaces de contacto solo admiten `https:`, para evitar código
  malicioso.
- **Fotos subidas.**
  - El tipo se comprueba por contenido real.
  - Máximo 5 MB.
  - Se convierten a WebP y pierden los metadatos, como la ubicación GPS.
- **Webhook de WhatsApp.** Solo atiende mensajes con la firma criptográfica de Meta, y una sola vez aunque
  Meta los repita.
- **Cabeceras de seguridad** en producción: CSP, HSTS, X-Frame-Options, etc.
- **Secretos.** Solo en el archivo `.env` local, que nunca se sube; el repo público no contiene ninguno.
- **Avisos push.** Nunca incluyen el celular del cliente.

### 4.6 Integraciones externas

| Servicio | Para qué | Estado |
|---|---|---|
| **WhatsApp Cloud API (Meta)** | Confirmar y cancelar citas, recordatorio de −35 min, aviso a quien pierde su hora | Programado y probado contra un WhatsApp simulado. **Falta**: crear la app en Meta, un chip propio, aprobar las plantillas `recordatorio_cita` y `cita_vencida` |
| **Web Push (VAPID)** | Avisos al barbero | Probado en navegador local. **Falta**: probar en un celular real (exige HTTPS) |
| **Supabase Storage** | Guardar las fotos en producción | Programado, probado con respuestas simuladas. **Falta**: el proyecto de Supabase |
| **IA (Groq)** | Asistente que responde en WhatsApp | Programado y probado con Groq simulado; probado a mano una vez con Groq real (ver sección 5). **Falta** la clave en producción y WhatsApp real |

---

## 5. Confirmación por WhatsApp: cómo funciona

1. El cliente reserva en la web.
   - Si faltan menos de 2 h, la cita nace confirmada y no hay nada más que hacer.
   - Si no, queda pendiente con un código.
2. La pantalla final muestra **"Confirmar por WhatsApp"**: abre un chat con el **número automático** (un chip
   aparte, no el de Luis) y el mensaje "Confirmo mi cita KRT482" ya escrito. Puede confirmar en ese momento.
3. Cuando el cliente escribe, Meta avisa a la web (`/api/whatsapp`), que:
   - verifica la firma;
   - busca el código **junto al número del cliente**;
   - confirma o cancela, según lo que pida el mensaje;
   - responde al cliente;
   - avisa a Luis por push.
4. **Una tarea cada 5 minutos** (`/api/cron/vencer`, protegida con una clave) aplica los tiempos:
   - −35 min: envía la plantilla `recordatorio_cita` con los botones "Sí, voy" y "No podré ir". Tocar un botón
     equivale a escribir "Confirmo mi cita KRT482" o "Cancelar KRT482".
   - −15 min: si sigue pendiente, pasa a "en riesgo" y avisa a Luis.
   - 0 min: si sigue en riesgo, vence.
   - Nunca envía el recordatorio dos veces a la misma cita, aunque la tarea se repita o corra dos veces a la
     vez.
5. **Si otro cliente reserva una hora en riesgo**, el primero recibe la plantilla `cita_vencida`. Si escribe
   después para confirmar, se le dice que su hora ya no está y se le enlaza a las horas libres de ese día.
6. **Si alguien escribe al número automático con una consulta** (sin código), recibe el WhatsApp de Luis
   para escribirle allí.
7. **Sin WhatsApp configurado**, o en citas sin código (reservadas antes de activarlo), nada queda en riesgo
   ni vence solo: las decide Luis desde el panel.

**Decisión tomada: número aparte.** Un número conectado a la API de Meta ya no se puede usar desde la app de
WhatsApp. Usar el de Luis le haría perder sus conversaciones normales.

**Decisiones tomadas en la última fase que conviene revisar con el experto.**
- La antelación mínima bajó de 2 horas a 5 minutos. Es lo que permite reservar a última hora y tomar horas en
  riesgo, pero cambia el negocio: ahora se puede reservar para dentro de un rato.
- Una cita "atendida" ya no ocupa agenda (si termina antes, la silla queda libre).
- Una cita que nace confirmada no recibe código, así que ese cliente aún no puede cancelarla por WhatsApp
  (lo resolverá el asistente con IA).
- Si la plantilla `recordatorio_cita` no está aprobada, el recordatorio no sale, pero la cita igual queda en
  riesgo a los 15 minutos. Hay que tenerla aprobada antes de activar WhatsApp.

**Fase 2: asistente con IA (programado; falta la clave de Groq).** Responde en lenguaje natural ("¿tienen hora
el sábado en la tarde?") usando cinco herramientas que siguen las mismas reglas de la web:

| Herramienta | Qué hace |
|---|---|
| `listar_catalogo_y_mis_citas` | Servicios, barberos y las citas activas de quien escribe |
| `consultar_huecos_dinamicos` | Horas libres de un día para esos servicios |
| `reservar_cita` | Reserva (nace confirmada si faltan menos de 2 h; si no, entra en el ciclo de −35 / −15 min) |
| `confirmar_asistencia` | Confirma; si otro tomó su hora en riesgo, ofrece las 3 siguientes libres |
| `cancelar_cita` | Cancela con la regla de los 35 minutos |

- **Seguridad:** la IA nunca elige el celular del cliente. Lo pone el servidor, tomado del remitente que Meta
  firma, así que un mensaje no puede actuar sobre las citas de otro número.
- Si el cliente tiene varias citas y no dice cuál, la IA debe preguntarle; no adivina.
- **Proveedor:** Groq, por su API compatible con OpenAI. Modelo por defecto `openai/gpt-oss-120b`: el modelo
  que se había pensado (`llama-3.3-70b-versatile`) Groq lo retiró el 16 de agosto de 2026 para cuentas que no
  son de empresa. Se cambia con `AI_MODEL`.
- **Cómo conversa:** hasta 3 rondas de herramientas por mensaje (p. ej. catálogo → horas libres → reservar) y
  luego la respuesta, en 12 segundos como máximo. Recuerda los últimos 6 mensajes de las últimas 2 horas, para entender "¿a qué hora?" o "a las 5, soy Sebastián".
- **Reglas del asistente** (en sus instrucciones): solo temas de la barbería (política de Meta para IA), nunca
  inventar precios ni horas, preguntar cuál cita si tiene varias y dar el WhatsApp de Luis ante reclamos. Que
  respete el tema depende del modelo: el código no puede impedirlo.
- **Ahorro de tokens y abuso** (el plan gratuito de Groq limita los tokens por minuto):
  - El texto del cliente se recorta a 250 caracteres. Respuestas con `temperature` 0.1 y tope de 220 tokens
    (si se corta sin texto, el cliente recibe un aviso amable).
  - El historial es de 6 mensajes de las últimas 2 horas; se guarda 24 h solo para contar el uso.
  - El prompt lleva el catálogo resumido con sus ids, así no hace falta consultarlo en cada conversación.
  - Anti-desvío reforzado: ante cambios de rol, pedir sus instrucciones, programar o temas ajenos, responde
    una sola frase fija.
  - **Multimedia** (audio, foto, sticker, video, documento): respuesta fija sin Groq. El asistente básico
    responde el contacto de Luis; el de IA, un aviso fijo.
  - **Límite por celular:** 12 mensajes por hora y 25 por día; pasado el tope, respuesta fija con el WhatsApp
    de Luis, sin Groq. Los códigos y los botones del recordatorio no cuentan ni se limitan.
- **Prueba real con Groq.** Reservó bien y el tope de 220 tokens no cortó nada, pero 2 de 4 conversaciones
  seguidas chocaron con el límite gratuito de 8.000 tokens por minuto (respuesta amable, sin reserva). **Riesgo
  abierto.** Mejoras posibles: medir los tokens de cada petición, y un segundo modelo de reserva (el límite es
  por modelo).
- **Si Groq falla** (sin red, demasiadas peticiones, error del servicio), responde el asistente básico. Si ya
  había reservado, confirmado o cancelado, le envía un mensaje fijo con lo hecho.
- **Sin IA** (sin `AI_PROVIDER`), responde el asistente básico: código y palabras clave.
- **Cada mensaje se atiende una sola vez**, aunque Meta lo repita mientras la IA está pensando.
- **Falta para activarlo:** una clave de Groq (`GROQ_API_KEY`) y `AI_PROVIDER=groq`, además de lo pendiente de
  WhatsApp. Conviene probarlo con unas 40 conversaciones reales antes de abrirlo al público.

---

## 6. Calidad y pruebas

| Tipo | Comando | Qué comprueba |
|---|---|---|
| Lógica | `npm test` | 601 pruebas (21 de noviembre): reglas, casos de uso, acciones, herramientas y adaptador de IA (con Groq simulado) y repositorios contra Postgres real |
| Cobertura | `npm run test:coverage` | 97,3 % de líneas, 96,2 % de sentencias, 90,5 % de ramas y 96,76 % de funciones (21 de noviembre; mínimo exigido: 90 %) |
| Mutación | `npm run test:mutation` | Rompe 73 reglas críticas a propósito y exige que alguna prueba lo note: 73 de 73 detectadas el 21 de noviembre (un mutante con el texto desfasado se corrigió y se comprobó a mano) |
| Navegador | `npm run test:e2e` | 230 pasadas, 0 fallidas y 4 omitidas de 234 (21 de noviembre): agenda en 320 px y escritorio, reserva, panel, WhatsApp de punta a punta (recordatorio, en riesgo, vencida, tomar una hora en riesgo), accesibilidad (axe), teclado, seguridad, móvil y escritorio |
| Dispositivos | `npm run test:devices` | iPhone 15, iPad Mini, Pixel 7, Galaxy S9+ (320 px), Safari, Firefox y Edge 1920. Con capturas; 25 pasadas, 0 fallidas y 3 omitidas de 28 (21 de noviembre). La agenda del panel no se prueba en Safari/iPhone en local (no guardan la cookie segura sin HTTPS) |
| Lighthouse | `npm run lighthouse` | Medido el 21 de noviembre sobre el build real, ahora también con el calendario y Chats del panel (sesión firmada). Accesibilidad y buenas prácticas, 100 en todas. SEO, 100 en las páginas públicas; 60 en las del panel, que llevan noindex a propósito. Rendimiento: |

| Página | Móvil | Escritorio |
|---|---|---|
| Portada `/` | 92 | 100 |
| `/reservar` | 99 | 100 |
| `/panel/entrar` | 99 | 100 |
| `/panel` (calendario) | 91 | 100 |
| `/panel/chats` | 100 | 100 |

En una primera corrida la portada móvil dio 83 (ruido de la máquina local: LCP 3,3 s, TBT 380 ms); en la segunda, 92. |
| Lint | `npm run lint` | ESLint estricto, cero avisos |
| Todo junto | `npm run check` | Solo al final del proyecto, cuando se pida |

**Cómo se verifica cada paso.** Para ahorrar tiempo, cada cambio pasa lint, tipos, las pruebas que toca y,
si es visual, pruebas de navegador puntuales con axe a 320 px y en escritorio. Las pruebas de navegador corren
sin IA (`AI_PROVIDER=""`); el camino con IA se comprobó a mano en Edge.

**Suite completa.** La corrida de cierre (21 de noviembre) cubrió `npm run check`, la suite E2E entera, la
mutación, los dispositivos y Lighthouse; no queda nada pendiente de recontar.

Detalle en [`qa-2026-11.md`](qa-2026-11.md) y [`auditoria-2026-11.md`](auditoria-2026-11.md).

**Fallos reales encontrados y corregidos gracias a las pruebas** (ejemplos):
- Bloqueos entre reservas simultáneas en la base de datos (1 de cada 10–20 veces).
- Un contraste de color insuficiente en los botones.
- El foco del teclado que se perdía.
- Un aviso del panel que podía quedarse cargando.
- Dos acciones simultáneas que se pisaban.
- Una plantilla de WhatsApp que Meta habría rechazado.
- "No puedo ir" con el código confirmaba la cita en vez de cancelarla.

---

## 7. Costos estimados al publicar (mensual, ~300 citas/mes)

Cifras comprobadas en las páginas oficiales en noviembre de 2026. Conviene revisarlas antes de contratar.

| Concepto | Opción recomendada | Opción mínima |
|---|---|---|
| Hosting de la web | Vercel Pro: 20 USD | Railway: ~5–15 USD (web y base juntas) |
| Base de datos | Supabase gratis (Pro 25 USD si crece) | Incluida en Railway |
| WhatsApp (Meta) | ~3–10 USD (solo mensajes automáticos; 1.000 de servicio gratis al mes) | Igual |
| IA (fase 2) | ~1–5 USD (Groq o Claude Haiku 5.5) | 0 USD con la capa gratuita de Groq |
| Dominio | ~1 USD (.com, pago anual) | Igual |
| **Total** | **~25–40 USD/mes** | **~10–25 USD/mes** |

**Notas.**
- El plan gratuito de Vercel no sirve: solo permite tareas programadas una vez al día y se necesitan cada
  5 minutos.
- Meta cobra en Perú por cada mensaje de plantilla. Su tarifa subió en octubre de 2026 y hay que revisar la
  vigente.

---

## 8. Qué falta para publicar

1. **Hosting y dominio** con HTTPS.
2. **Base de datos de producción.** Aplicar las migraciones.
3. **Variables de producción nuevas**, nunca las de desarrollo:
   - clave del panel;
   - claves de avisos push;
   - credenciales de WhatsApp, Supabase y la tarea programada.
4. **WhatsApp.**
   - Chip aparte.
   - App en Meta for Developers y verificación del negocio (RUC).
   - Webhook configurado.
   - Plantillas `recordatorio_cita` (con sus dos botones) y `cita_vencida` aprobadas.
   - Tarea cada 5 minutos (Railway o cron-job.org; el plan gratuito de Vercel no llega).
5. **Contenido real.**
   - Video y fotos de la barbería (hoy son de bancos libres: Mixkit y Unsplash).
   - Testimonios con permiso.
   - Libro de reclamaciones virtual.
   - Aviso de privacidad (Ley 29733).
6. **Piloto** de una o dos semanas.

---

## 9. Limitaciones conocidas y riesgos

- **Nada probado con servicios reales.** WhatsApp, Supabase y los avisos en celulares solo se probaron con
  simulaciones.
- **Dispositivos emulados, no físicos.** Falta probar en un iPhone y un Android reales.
- **Una sola clave del panel para toda la barbería.** No hay usuarios por barbero ni registro de quién hizo
  qué.
- **El freno de intentos de acceso vive en la memoria del servidor.** Si la web corre en varias instancias,
  habría que moverlo a un almacenamiento compartido.
- **Límite de 2 citas por celular.** Puede superarse con dos reservas exactamente simultáneas del mismo
  número (riesgo bajo).
- **Reservas de última hora.** Con 5 minutos de antelación mínima, alguien puede reservar para "ya". Es lo
  que se pidió, pero conviene confirmarlo con Luis.
- **Mensajes de WhatsApp.**
  - Sin IA, los clientes que escriben sin código solo reciben instrucciones y el contacto de Luis.
  - Entender si un texto pide cancelar se hace con palabras clave ("cancelar", "no puedo", "no voy"…). Una
    frase rara puede interpretarse mal; el cliente recibe siempre la respuesta y puede corregirlo.
  - Quien reservó con menos de 2 h (nace confirmada, sin código) no puede cancelar por WhatsApp.
  - Si un cliente usa nombre de usuario en vez de número, Meta puede no enviar su número y el mensaje se
    ignora.
- **Medios provisionales.** El video y las fotos vienen de bancos libres (Mixkit y Unsplash): uso comercial
  permitido, pero cualquiera puede descargar los archivos desde el repositorio público.
- **El repositorio es público.** Cualquiera puede leer el código, aunque no hay secretos ni datos reales.

---

**Del asistente con IA:**
- **Privacidad.** Los mensajes de los clientes pasan por Groq (un proveedor externo) y se guardan 24 horas en la
  base (2 h de contexto; el resto cuenta el uso). Conviene mencionarlo en el aviso de privacidad.
- **Costo y abuso.** Cada celular tiene un tope de 12 mensajes por hora y 25 por día, y la multimedia no llama a
  Groq. Aun así, con el plan gratuito basta una ráfaga para chocar con el límite de tokens por minuto (ver la
  prueba real, sección 5).
- **Tiempo de respuesta.** La IA puede tardar hasta 12 segundos; el hosting tiene que permitir peticiones de esa
  duración en el webhook.
- **Next.js.** `npm audit` marca un aviso moderado (GHSA-mfr8-8qww-v76h) en la versión instalada, corregido en
  16.4.6. Afecta a `unstable_cache`, que el proyecto no usa; aun así conviene actualizar.

## 10. Preguntas sugeridas para el experto

1. ¿Es adecuada la arquitectura (Clean Architecture con Next.js) para un negocio de este tamaño, o es
   demasiado para mantenerla?
2. ¿Hosting recomendado (Vercel + Supabase o Railway) para costo, mantenimiento y la tarea cada 5 minutos?
3. ¿Conviene que el repositorio siga siendo público?
4. **WhatsApp.**
   - ¿Es buena idea un número aparte?
   - ¿Hay que registrarse como proveedor tecnológico de Meta para gestionarlo en nombre del cliente?
   - ¿Qué implica la verificación del negocio?
5. **Fase 2 (IA).**
   - ¿Qué riesgos tiene un asistente que reserva solo?
   - ¿Qué dice la política de Meta sobre proveedores de IA?
   - ¿Basta con que el asistente use el número verificado del remitente para identificar al cliente?
6. **Reglas de tiempo.** ¿Son razonables 5 min de antelación mínima, 35 min para el recordatorio y 15 min
   para dejar la hora en riesgo? ¿Debería una cita atendida seguir ocupando su hueco?
7. **Seguridad.**
   - ¿Es suficiente una clave única para el panel?
   - ¿Hace falta autenticación con usuarios, doble factor o auditoría?
8. **Legal (Perú).**
   - Ley de protección de datos personales (Ley 29733).
   - Libro de reclamaciones virtual.
   - Uso de WhatsApp para avisos.
9. ¿Qué haría falta para atender a **varias barberías** con el mismo sistema?

---

## 11. Glosario

- **Clean Architecture:** forma de ordenar el código en capas para que las reglas del negocio no dependan
  de detalles técnicos (base de datos, proveedores).
- **Commit / push:** guardar un cambio en el historial de Git y subirlo a GitHub.
- **Webhook:** dirección de la web a la que un servicio externo (Meta) avisa cuando pasa algo, como un
  mensaje nuevo.
- **Plantilla de WhatsApp:** mensaje que Meta aprueba de antemano. Es lo único que una empresa puede enviar
  por iniciativa propia, y se cobra.
- **Cron / tarea programada:** algo que se ejecuta solo cada cierto tiempo, como el ciclo de
  confirmaciones cada 5 minutos.
- **En riesgo (liberación condicional):** cita que no se confirmó a 15 minutos de empezar. Sigue siendo del
  cliente, pero otro puede tomar la hora.
- **Respuesta rápida:** botón de una plantilla de WhatsApp que, al tocarlo, envía un texto fijo.
- **Push (Web Push):** aviso que aparece en el celular o la PC aunque la web esté cerrada.
- **Migración:** cambio versionado en la estructura de la base de datos.
- **Prueba de mutación:** romper el código a propósito para comprobar que alguna prueba lo detecta.
- **Lighthouse:** herramienta de Google que puntúa velocidad, accesibilidad, buenas prácticas y SEO.
- **HTTPS:** conexión cifrada; necesaria para publicar, para los avisos push y para WhatsApp.
- **Variables de entorno (.env):** configuración y secretos que no van en el código.

---

## 12. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Instrucciones técnicas completas | [`README.md`](../README.md) y [`CLAUDE.md`](../CLAUDE.md) |
| Pruebas y auditoría | [`docs/qa-2026-11.md`](qa-2026-11.md), [`docs/auditoria-2026-11.md`](auditoria-2026-11.md) |
| Configurar WhatsApp paso a paso | `README.md`, sección "Configurar WhatsApp" |
| Variables necesarias | [`.env.example`](../.env.example) |
| Créditos de fotos y video | `public/images/CREDITS.md`, `public/videos/CREDITS.md` |
| Ciclo de confirmaciones | `src/application/use-cases/booking/confirmation-cycle.ts` |
| Herramientas del asistente con IA | `src/application/use-cases/assistant/` |
| Asistente con Groq | `src/infrastructure/assistant/groq-assistant.ts` |
| Línea de tiempo del panel | `src/presentation/components/panel/agenda-calendar.tsx`, `src/presentation/lib/timeline.ts` |
| Reglas de tiempo (2 h, 35 min, 15 min, 5 min) | `src/core/scheduling/booking-policy.ts` |
| Historial de cambios | `git log` (216 commits desde el 29 de octubre de 2026) |
