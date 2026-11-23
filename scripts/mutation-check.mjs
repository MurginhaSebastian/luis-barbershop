// Rompe a propósito reglas críticas y comprueba que algún test lo detecta: `npm run test:mutation`.
// Necesita Postgres encendido. Cada archivo se restaura aunque el proceso falle a mitad.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const mutants = [
  ["TimeSlot: citas que solo se tocan cuentan como solape", "src/core/entities/time-slot.ts", "return this.start < other.end && other.start < this.end;", "return this.start <= other.end && other.start <= this.end;"],
  ["Antelación mínima: excluye la hora exacta", "src/core/scheduling/availability.ts", "if (slot.start < notBefore || slot.start > notAfter) continue;", "if (slot.start <= notBefore || slot.start > notAfter) continue;"],
  ["Plazo máximo: se deja de comprobar", "src/core/scheduling/availability.ts", "if (slot.start < notBefore || slot.start > notAfter) continue;", "if (slot.start < notBefore) continue;"],
  ["Las citas pendientes dejan de ocupar agenda", "src/core/entities/appointment.ts", "new Set([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])", "new Set([AppointmentStatus.CONFIRMED])"],
  ["En riesgo: la cita sigue ocupando su hueco", "src/core/entities/appointment.ts", "new Set([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])", "new Set([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.AT_RISK])"],
  ["Reserva: con justo 2 h de antelación nace confirmada", "src/core/entities/appointment.ts", "input.bookedAt.getTime() < BORN_CONFIRMED_UNDER_MINUTES * MINUTE_MS", "input.bookedAt.getTime() <= BORN_CONFIRMED_UNDER_MINUTES * MINUTE_MS"],
  ["Reserva: tomar una hora en riesgo no vence la anterior", "src/application/use-cases/booking/create-appointment.ts", "await this.deps.appointments.save(appointment, displacing);", "await this.deps.appointments.save(appointment);"],
  ["Cancelar: una confirmada se cancela con menos de 35 min", "src/core/entities/appointment.ts", "return (this.status === AppointmentStatus.PENDING || this.status === AppointmentStatus.AT_RISK) && minutesLeft > 0;", "return minutesLeft > 0;"],
  ["Una cita cancelada se puede reabrir", "src/core/entities/appointment.ts", "  CANCELLED: [],", '  CANCELLED: ["CONFIRMED"],'],
  ["El total ignora la cantidad de productos", "src/core/entities/appointment.ts", "sum + p.unitPriceCents * p.quantity", "sum + p.unitPriceCents"],
  ["Zona horaria: Lima deja de ser UTC-5", "src/core/scheduling/booking-policy.ts", "SHOP_UTC_OFFSET_MINUTES = -300", "SHOP_UTC_OFFSET_MINUTES = -240"],
  ["Límite de citas: permite una de más", "src/application/use-cases/booking/create-appointment.ts", ".length >= MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER", ".length > MAX_ACTIVE_APPOINTMENTS_PER_CUSTOMER"],
  ["Sin preferencia: no reintenta con otro barbero", "src/application/use-cases/booking/create-appointment.ts", "if (!(error instanceof SlotUnavailableError)) throw error;", "throw error;"],
  ["Sin preferencia: asigna al barbero más cargado", "src/application/use-cases/booking/create-appointment.ts", ".sort((a, b) => b.slots.length - a.slots.length)", ".sort((a, b) => a.slots.length - b.slots.length)"],
  ["Clave: cualquier clave sirve", "src/infrastructure/auth/password.ts", "return timingSafeEqual(await derive(password, salt), expected);", "await derive(password, salt);\n  return true;"],
  ["Sesión: una sesión caducada sigue valiendo", "src/infrastructure/auth/session.ts", "return Number(expires) > now.getTime();", "return true;"],
  ["Sesión: se acepta cualquier firma", "src/infrastructure/auth/session.ts", "if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;", ""],
  ["Freno: permite un intento más", "src/infrastructure/auth/login-throttle.ts", "return entry.count >= MAX_FAILURES;", "return entry.count > MAX_FAILURES;"],
  ["Panel: cambiar estado sin comprobar sesión", "src/app/panel/actions.ts", "  await requirePanelSession();\n  const parsed = statusChange", "  const parsed = statusChange"],
  ["Error de solape de Postgres sin traducir", "src/infrastructure/db/repositories/appointment-repository.ts", 'const EXCLUSION_VIOLATION = "23P01";', 'const EXCLUSION_VIOLATION = "23505";'],
  ["Pendientes: trae las citas pasadas", "src/infrastructure/db/repositories/appointment-repository.ts", "and(eq(appointments.status, status), gt(appointments.endsAt, from))", "and(eq(appointments.status, status), lt(appointments.endsAt, from))"],
  ["Teléfono: se deja de normalizar", "src/core/entities/customer.ts", "return /^9\\d{8}$/.test(digits) ? `51${digits}` : digits;", "return digits;"],
  ["Reserva: se puede saltar pasos por URL", "src/presentation/lib/booking-flow.ts", "return Math.min(requested ?? 1, reachable) as BookingStep;", "return (requested ?? 1) as BookingStep;"],
  ["Validación: acepta cualquier celular", "src/app/reservar/booking-schema.ts", '.pipe(z.string().regex(/^(\\+?51)?9\\d{8}$/, "Escribe un celular de 9 dígitos que empiece por 9."))', ".pipe(z.string())"],
  ["Panel: guardar un servicio sin comprobar sesión", "src/app/panel/admin-actions.ts", "export async function saveServiceAction(_prev: AdminState, form: FormData): Promise<AdminState> {\n  await requirePanelSession();", "export async function saveServiceAction(_prev: AdminState, form: FormData): Promise<AdminState> {"],
  ["Panel: quitar un bloqueo sin comprobar sesión", "src/app/panel/admin-actions.ts", "export async function removeBlockAction(id: string): Promise<AdminState> {\n  await requirePanelSession();", "export async function removeBlockAction(id: string): Promise<AdminState> {"],
  ["Precio: los céntimos se calculan mal", "src/app/panel/admin-schema.ts", 'Number(cents.padEnd(2, "0"))', "Number(cents)"],
  ["Horario: los tramos se pueden pisar", "src/core/catalog/rules.ts", "if (i > 0 && openMinute < sorted[i - 1].closeMinute) {", "if (i < 0) {"],
  ["Precio: se aceptan negativos", "src/core/catalog/rules.ts", "priceCents < 0 || ", ""],
  ["Bloqueo: cuenta citas de otros barberos", "src/application/use-cases/admin/manage-schedule.ts", "a.blocksSchedule() && (!input.barberId || a.barberId === input.barberId)", "a.blocksSchedule()"],
  ["Bloqueo: se aceptan periodos pasados", "src/application/use-cases/admin/manage-schedule.ts", 'if (input.slot.end <= this.deps.now()) throw new InvalidCatalogError("Ese periodo ya pasó.");', ""],
  ["Barbero: el dueño se puede renombrar u ocultar", "src/core/catalog/rules.ts", "if (current.isOwner && (next.name.trim() !== current.name || !next.active)) {", "if (false) {"],
  ["Barbero: el aviso cuenta citas canceladas", "src/application/use-cases/admin/manage-catalog.ts", "appointments.filter((a) => a.blocksSchedule()).length", "appointments.length"],
  ["Contacto: se aceptan enlaces que no son https", "src/core/entities/site.ts", 'return new URL(value).protocol === "https:";', "return Boolean(new URL(value).protocol);"],
  ["Foto: se acepta un archivo disfrazado", "src/core/entities/image.ts", 'if (!detectImageType(bytes)) throw new InvalidImageError("Solo se aceptan fotos JPG, PNG o WebP.");', ""],
  ["Foto: el nombre deja rutas fuera de la carpeta", "src/infrastructure/images/local-storage.ts", "const FILE_NAME = /^[0-9a-f-]{36}\\.webp$/;", "const FILE_NAME = /\\.webp$/;"],
  ["Panel web: subir una foto sin comprobar sesión", "src/app/panel/site-actions.ts", "export async function uploadImageAction(_prev: AdminState, form: FormData): Promise<AdminState> {\n  await requirePanelSession();", "export async function uploadImageAction(_prev: AdminState, form: FormData): Promise<AdminState> {"],
  ["Avisos: activar un dispositivo sin comprobar sesión", "src/app/panel/push-actions.ts", "export async function subscribePushAction(input: unknown): Promise<AdminState> {\n  await requirePanelSession();", "export async function subscribePushAction(input: unknown): Promise<AdminState> {"],
  ["Avisos: se aceptan endpoints que no son https", "src/core/entities/push.ts", 'url.protocol !== "https:" || ', ""],
  ["Avisos: un fallo pasajero borra el dispositivo", "src/application/use-cases/push/manage-push.ts", "        } catch {\n          // Un dispositivo que falla no impide avisar a los demás.\n          report.failed++;", "        } catch {\n          // Un dispositivo que falla no impide avisar a los demás.\n          await this.deps.pushSubscriptions.remove(subscription.endpoint);\n          report.failed++;"],
  ["Reserva: un aviso fallido revienta tras responder", "src/app/reservar/actions.ts", '        console.error("aviso de reserva", error);\n      }', "        throw error;\n      }"],
  ["Portada: anuncia abierto en un feriado", "src/core/scheduling/opening-status.ts", "upcoming.push(...withoutClosures(range, closures).filter((part) => part.end > now));", "upcoming.push(...[range].filter((part) => part.end > now));"],
  ["Portada: a la hora de cierre sigue abierta", "src/core/scheduling/opening-status.ts", "upcoming.push(...withoutClosures(range, closures).filter((part) => part.end > now));", "upcoming.push(...withoutClosures(range, closures).filter((part) => part.end >= now));"],
  ["Confirmación: una cita confirmada puede vencer", "src/core/entities/appointment.ts", '  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],', '  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"],'],
  ["Panel: se puede vencer una cita a mano", "src/app/panel/actions.ts", '.exclude(["EXPIRED", "AT_RISK"])', '.exclude(["AT_RISK"])'],
  ["Panel: se puede poner una cita en riesgo a mano", "src/app/panel/actions.ts", '.exclude(["EXPIRED", "AT_RISK"])', '.exclude(["EXPIRED"])'],
  ["WhatsApp: se acepta cualquier firma", "src/infrastructure/whatsapp/whatsapp-cloud.ts", "return !!received && received.length === expected.length && timingSafeEqual(received, expected);", "return true;"],
  ["WhatsApp: confirma la cita de otro número", "src/application/use-cases/booking/booking-confirmation.ts", "if (appointment?.customerId !== customer.id) continue;", "if (!appointment) continue;"],
  ["WhatsApp: un aviso repetido se atiende dos veces", "src/application/use-cases/assistant/handle-incoming-message.ts", '    if (!(await this.claim(message.id))) return { kind: "ignored" };', ""],
  ["WhatsApp: un fallo deja el aviso reclamado para siempre", "src/application/use-cases/assistant/handle-incoming-message.ts", "      await this.deps.processedMessages.release(message.id);", ""],
  ["WhatsApp: una cita vencida se reabre", "src/application/use-cases/booking/booking-confirmation.ts", "if (status !== AppointmentStatus.PENDING && status !== AppointmentStatus.AT_RISK) return this.closedOutcome(appointment);", "if (status === AppointmentStatus.CANCELLED) return this.closedOutcome(appointment);"],
  ["WhatsApp: \"no podré ir\" confirma la cita", "src/application/use-cases/booking/booking-confirmation.ts", "return wantsToCancel(text) ? this.cancel(appointment) : this.confirm(appointment);", "return this.confirm(appointment);"],
  ["Vencida: una pendiente vence sin pasar por en riesgo", "src/core/entities/appointment.ts", '  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW", "AT_RISK"],', '  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW", "AT_RISK", "EXPIRED"],'],
  ["Panel: las citas que se cruzan van todas en el mismo carril", "src/presentation/lib/timeline.ts", "if (lane < 0) lane = laneEnds.length;", "if (lane < 0) lane = 0;"],
  ["IA: las herramientas usan otro celular que el del remitente", "src/infrastructure/assistant/groq-assistant.ts", "{ verifiedPhone: phone, now }", '{ verifiedPhone: "51999999999", now }'],
  ["IA: el historial no se limita a las 2 últimas horas", "src/infrastructure/assistant/groq-assistant.ts", "new Date(now.getTime() - HISTORY_WINDOW_MS), HISTORY_TURNS", "new Date(0), HISTORY_TURNS"],
  ["IA: sin tope de rondas de herramientas", "src/infrastructure/assistant/groq-assistant.ts", "const withTools = round < MAX_TOOL_ROUNDS;", "const withTools = round < 99;"],
  ["Bot: actúa sobre la cita de otro número", "src/application/use-cases/assistant/bot-tool-executor.ts", "return appointment && customer && appointment.customerId === customer.id", "return appointment"],
  ["Bot: con varias citas adivina cuál", "src/application/use-cases/assistant/bot-tool-executor.ts", "if (candidates.length > 1) {", "if (candidates.length > 9) {"],
  ["Bot: una reserva pendiente queda sin código (fuera del ciclo)", "src/application/use-cases/assistant/bot-tool-executor.ts", "() => this.deps.confirmation.issue(appointment).then(() => ({ failed: 0 })),", ""],
  ["Webhook: atiende avisos sin la firma de Meta", "src/app/api/whatsapp/route.ts", "  if (!isSignedByMeta(raw, request.headers.get(\"x-hub-signature-256\"), config.appSecret)) {", "  if (false) {"],
  ["Webhook: atiende mensajes de otro número del negocio", "src/app/api/whatsapp/route.ts", ' && change.value.metadata?.phone_number_id === config.phoneNumberId', ""],
  ["Vencer: pisa una cita que se acaba de confirmar", "src/infrastructure/db/repositories/appointment-repository.ts", ".where(and(eq(appointments.id, next.id), eq(appointments.status, expected)))", ".where(eq(appointments.id, next.id))"],
  ["Ciclo: el aviso de -35 min se repite", "src/application/use-cases/booking/confirmation-cycle.ts", "      if (!(await this.deps.appointments.claimReminder(appointment.id, now))) continue;", ""],
  ["Ciclo: pone en riesgo antes de los -15 min", "src/application/use-cases/booking/confirmation-cycle.ts", "if (left > AT_RISK_MINUTES_BEFORE || left <= 0) continue;", "if (left > REMINDER_MINUTES_BEFORE || left <= 0) continue;"],
  ["Ciclo: pone en riesgo sin WhatsApp", "src/application/use-cases/booking/confirmation-cycle.ts", "    if (this.deps.messaging) {", "    if (this.deps.messaging || true) {"],
  ["Ciclo: vence una cita en riesgo antes de su hora", "src/application/use-cases/booking/confirmation-cycle.ts", "      if (appointment.slot.start > now) continue;", ""],
  ["Panel: un cambio pisa a otro simultáneo", "src/application/use-cases/agenda/change-appointment-status.ts", "    if (!changed) throw new InvalidStatusChangeError();", ""],
  ["Cron: se puede llamar sin el secreto", "src/app/api/cron/vencer/route.ts", '  if (!secret || !sameSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {', "  if (false) {"],
  ["Error inesperado: se filtra el mensaje interno", "src/app/reservar/actions.ts", 'return { status: "error", message: "No pudimos registrar tu reserva. Inténtalo de nuevo en unos minutos." };', 'return { status: "error", message: String(error) };'],
  ["Asistente: el límite por hora deja pasar un mensaje de más", "src/infrastructure/assistant/groq-assistant.ts", ">= MAX_PER_HOUR", "> MAX_PER_HOUR"],
  ["Asistente: el límite por día deja pasar un mensaje de más", "src/infrastructure/assistant/groq-assistant.ts", ">= MAX_PER_DAY", "> MAX_PER_DAY"],
  ["Asistente: la multimedia llega a Groq", "src/infrastructure/assistant/groq-assistant.ts", "if (message.media) {", "if (false) {"],
  ["Asistente: pasado el límite, además se llama a Groq", "src/infrastructure/assistant/groq-assistant.ts", "Para seguir, ${next}.`);\n      return { kind: \"answered\" };", "Para seguir, ${next}.`);"],
];

const runTests = () => spawnSync("npx vitest run", { shell: true, stdio: "ignore" }).status;

// Si los tests ya fallan sin tocar nada, todo saldría "detectada" sin significar nada.
if (runTests() !== 0) {
  console.error("Los tests no pasan sin mutar: arréglalos antes (¿Postgres encendido?).");
  process.exit(2);
}

const survivors = [];
for (const [name, path, from, to] of mutants) {
  const original = readFileSync(path, "utf8");
  const source = original.replaceAll("\r\n", "\n");
  if (!source.includes(from)) {
    console.log(`NO SE APLICÓ: ${name}`);
    survivors.push(name);
    continue;
  }
  writeFileSync(path, source.replace(from, () => to));
  try {
    const status = runTests();
    console.log(`${status === 0 ? "SOBREVIVE" : "detectada"}: ${name}`);
    if (status === 0) survivors.push(name);
  } finally {
    writeFileSync(path, original);
  }
}

console.log(`\n${mutants.length - survivors.length} de ${mutants.length} detectadas`);
process.exit(survivors.length ? 1 : 0);
