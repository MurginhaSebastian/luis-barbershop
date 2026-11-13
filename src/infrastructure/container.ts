import { ChangeAppointmentStatusUseCase } from "@/application/use-cases/agenda/change-appointment-status";
import { GetAgendaUseCase } from "@/application/use-cases/agenda/get-agenda";
import { ManageCatalogUseCase } from "@/application/use-cases/admin/manage-catalog";
import { ManageSiteUseCase } from "@/application/use-cases/admin/manage-site";
import { ManagePushUseCase } from "@/application/use-cases/push/manage-push";
import { ManageScheduleUseCase } from "@/application/use-cases/admin/manage-schedule";
import { GetAvailableSlotsUseCase } from "@/application/use-cases/booking/get-available-slots";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { BookingConfirmationUseCase } from "@/application/use-cases/booking/booking-confirmation";
import { GetCatalogUseCase } from "@/application/use-cases/catalog/get-catalog";
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
import { readWhatsAppConfig, WhatsAppCloudSender } from "./whatsapp/whatsapp-cloud";

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
    messaging: whatsapp ? new WhatsAppCloudSender(whatsapp) : null,
    now: () => new Date(),
    randomBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)),
  };
  return {
    getCatalog: new GetCatalogUseCase(deps),
    getAvailableSlots: new GetAvailableSlotsUseCase(deps),
    createAppointment: new CreateAppointmentUseCase(deps),
    bookingConfirmation: new BookingConfirmationUseCase(deps),
    getAgenda: new GetAgendaUseCase(deps),
    manageCatalog: new ManageCatalogUseCase(deps),
    manageSchedule: new ManageScheduleUseCase(deps),
    manageSite: new ManageSiteUseCase(deps),
    managePush: new ManagePushUseCase(deps),
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
