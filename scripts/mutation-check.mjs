// Rompe a propósito reglas críticas y comprueba que algún test lo detecta: `npm run test:mutation`.
// Necesita Postgres encendido. Cada archivo se restaura aunque el proceso falle a mitad.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const mutants = [
  ["TimeSlot: citas que solo se tocan cuentan como solape", "src/core/entities/time-slot.ts", "return this.start < other.end && other.start < this.end;", "return this.start <= other.end && other.start <= this.end;"],
  ["Antelación mínima: excluye la hora exacta", "src/core/scheduling/availability.ts", "if (slot.start < notBefore || slot.start > notAfter) continue;", "if (slot.start <= notBefore || slot.start > notAfter) continue;"],
  ["Plazo máximo: se deja de comprobar", "src/core/scheduling/availability.ts", "if (slot.start < notBefore || slot.start > notAfter) continue;", "if (slot.start < notBefore) continue;"],
  ["Las citas pendientes dejan de ocupar agenda", "src/core/entities/appointment.ts", "  AppointmentStatus.PENDING,\n  AppointmentStatus.CONFIRMED,\n  AppointmentStatus.COMPLETED,\n]);", "  AppointmentStatus.CONFIRMED,\n  AppointmentStatus.COMPLETED,\n]);"],
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
  ["Confirmación: el plazo ignora la hora de la cita", "src/core/entities/confirmation.ts", "      start.getTime() - CONFIRM_BEFORE_START_MINUTES * MINUTE_MS,", "      Infinity,"],
  ["Panel: se puede vencer una cita a mano", "src/app/panel/actions.ts", '.exclude(["EXPIRED"])', ""],
  ["WhatsApp: se acepta cualquier firma", "src/infrastructure/whatsapp/whatsapp-cloud.ts", "return !!received && received.length === expected.length && timingSafeEqual(received, expected);", "return true;"],
  ["Error inesperado: se filtra el mensaje interno", "src/app/reservar/actions.ts", 'return { status: "error", message: "No pudimos registrar tu reserva. Inténtalo de nuevo en unos minutos." };', 'return { status: "error", message: String(error) };'],
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
