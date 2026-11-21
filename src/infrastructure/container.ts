import { MessageBatcher } from "@/application/use-cases/assistant/message-batcher";
import { BotToolExecutor } from "@/application/use-cases/assistant/bot-tool-executor";
import { HandleIncomingMessageUseCase } from "@/application/use-cases/assistant/handle-incoming-message";
import { ChangeAppointmentStatusUseCase } from "@/application/use-cases/agenda/change-appointment-status";
import { GetAgendaUseCase } from "@/application/use-cases/agenda/get-agenda";
import { ManageCatalogUseCase } from "@/application/use-cases/admin/manage-catalog";
import { ManageSiteUseCase } from "@/application/use-cases/admin/manage-site";
import { ManagePushUseCase } from "@/application/use-cases/push/manage-push";
import { ManageScheduleUseCase } from "@/application/use-cases/admin/manage-schedule";
import { GetAvailableSlotsUseCase } from "@/application/use-cases/booking/get-available-slots";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { BookingConfirmationUseCase } from "@/application/use-cases/booking/booking-confirmation";
import { ConfirmationCycleUseCase } from "@/application/use-cases/booking/confirmation-cycle";
import { GetCatalogUseCase } from "@/application/use-cases/catalog/get-catalog";
import { aiAssistantEnabled, selectAssistant } from "./assistant/select-assistant";
import { getDb } from "./db/client";
import { DrizzleAppointmentRepository } from "./db/repositories/appointment-repository";
import { DrizzleBarberRepository, DrizzleProductRepository, DrizzleServiceRepository } from "./db/repositories/catalog-repositories";
import { DrizzleCustomerRepository } from "./db/repositories/customer-repository";
import { DrizzleScheduleRepository } from "./db/repositories/schedule-repository";
import { DrizzleSiteSettingsRepository } from "./db/repositories/site-settings-repository";
import { LocalImageStorage } from "./images/local-storage";
import { selectImageStorage } from "./images/select-storage";
import { SharpImageOptimizer } from "./images/sharp-optimizer";
import { DrizzlePushSubscriptionRepository } from "./db/repositories/push-subscription-repository";
import { readVapidKeys, WebPushSender } from "./push/web-push-sender";
import { DrizzleConfirmationRepository } from "./db/repositories/confirmation-repository";
import { DrizzleConversationRepository } from "./db/repositories/conversation-repository";
import { DrizzleProcessedMessageRepository } from "./db/repositories/processed-message-repository";
import { readWhatsAppConfig, WhatsAppCloudSender } from "./whatsapp/whatsapp-cloud";
import type { IMessagingService } from "@/application/ports/messaging";
import { withDevReplies } from "./whatsapp/dev-replies";

const devReplies = (m: IMessagingService) => (process.env.NODE_ENV !== "production" ? withDevReplies(m) : m);

/** Raíz de composición: único sitio donde los casos de uso reciben sus implementaciones concretas. */
export function getUseCases() {
  const db = getDb();
  const vapid = readVapidKeys(process.env);
  const whatsapp = readWhatsAppConfig(process.env);
  const deps = {
    barbers: new DrizzleBarberRepository(db),
    services: new DrizzleServiceRepository(db),
    products: new DrizzleProductRepository(db),
    customers: new DrizzleCustomerRepository(db),
    schedule: new DrizzleScheduleRepository(db),
    appointments: new DrizzleAppointmentRepository(db),
    siteSettings: new DrizzleSiteSettingsRepository(db),
    images: selectImageStorage(process.env),
    imageOptimizer: new SharpImageOptimizer(),
    pushSubscriptions: new DrizzlePushSubscriptionRepository(db),
    pushSender: vapid ? new WebPushSender(vapid) : null,
    confirmations: new DrizzleConfirmationRepository(db),
    processedMessages: new DrizzleProcessedMessageRepository(db),
    siteUrl: process.env.SITE_URL?.replace(/\/$/, ""),
    messaging: whatsapp ? devReplies(new WhatsAppCloudSender(whatsapp)) : null,
    confirmationNumber: whatsapp?.displayNumber ?? null,
    now: () => new Date(),
    randomBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)),
  };
  const managePush = new ManagePushUseCase(deps);
  const getAvailableSlots = new GetAvailableSlotsUseCase(deps);
  const createAppointment = new CreateAppointmentUseCase(deps);
  const bookingConfirmation = new BookingConfirmationUseCase(deps);
  const botTools = new BotToolExecutor({
    ...deps,
    availability: getAvailableSlots,
    booking: createAppointment,
    confirmation: bookingConfirmation,
    push: managePush,
  });
  return {
    getCatalog: new GetCatalogUseCase(deps),
    getAvailableSlots,
    createAppointment,
    bookingConfirmation,
    /** Lo que escriben al número automático: se reclama cada mensaje y lo atiende el asistente elegido. */
    incomingMessages: new HandleIncomingMessageUseCase({
      processedMessages: deps.processedMessages,
      assistant: selectAssistant(process.env, {
        ...deps,
        fallback: bookingConfirmation,
        tools: botTools,
        conversations: new DrizzleConversationRepository(db),
      }),
    }),
    getAgenda: new GetAgendaUseCase(deps),
    manageCatalog: new ManageCatalogUseCase(deps),
    manageSchedule: new ManageScheduleUseCase(deps),
    manageSite: new ManageSiteUseCase(deps),
    managePush,
    confirmationCycle: new ConfirmationCycleUseCase({ ...deps, alerts: managePush }),
    changeAppointmentStatus: new ChangeAppointmentStatusUseCase(deps),
  };
}

/** Fotos en el disco del servidor (desarrollo, o hosting con disco propio). */
export function getLocalImages() {
  return new LocalImageStorage(process.env.UPLOADS_DIR || ".uploads");
}

/** La clave pública VAPID: el navegador la necesita para suscribirse. No es secreta. */
export function getVapidPublicKey(): string | null {
  return readVapidKeys(process.env)?.publicKey ?? null;
}

/** Credenciales de WhatsApp, o null si no está configurado. Las usa el webhook para verificar a Meta. */
export function getWhatsAppConfig() {
  return readWhatsAppConfig(process.env);
}

/** El número de WhatsApp del asistente de IA, o null si no está activo (reservar por ahí solo tiene sentido con IA). */
export function getAssistantWhatsApp(): string | null {
  return aiAssistantEnabled(process.env) ? (readWhatsAppConfig(process.env)?.displayNumber ?? null) : null;
}

let batcher: MessageBatcher | null | undefined;

/**
 * Agrupa los textos seguidos de un celular (WHATSAPP_DEBOUNCE_MS, 3500 por defecto; 0 lo apaga). Solo con la IA
 * activa: el asistente básico responde a códigos, que no se agrupan. Memoizado: el búfer vive en el proceso.
 */
export function getMessageBatcher(): MessageBatcher | null {
  if (batcher !== undefined) return batcher;
  const raw = process.env.WHATSAPP_DEBOUNCE_MS?.trim();
  const delayMs = raw ? Number(raw) : 3500;
  batcher =
    aiAssistantEnabled(process.env) && delayMs > 0
      ? new MessageBatcher({ delayMs, flush: (message) => getUseCases().incomingMessages.handleClaimed(message) })
      : null;
  return batcher;
}
