import { GetAvailableSlotsUseCase } from "@/application/use-cases/booking/get-available-slots";
import { CreateAppointmentUseCase } from "@/application/use-cases/booking/create-appointment";
import { GetCatalogUseCase } from "@/application/use-cases/catalog/get-catalog";
import { getDb } from "./db/client";
import { DrizzleAppointmentRepository } from "./db/repositories/appointment-repository";
import { DrizzleBarberRepository, DrizzleProductRepository, DrizzleServiceRepository } from "./db/repositories/catalog-repositories";
import { DrizzleCustomerRepository } from "./db/repositories/customer-repository";
import { DrizzleScheduleRepository } from "./db/repositories/schedule-repository";

/** Raíz de composición: único sitio donde los casos de uso reciben sus implementaciones concretas. */
export function getUseCases() {
  const db = getDb();
  const deps = {
    barbers: new DrizzleBarberRepository(db),
    services: new DrizzleServiceRepository(db),
    products: new DrizzleProductRepository(db),
    customers: new DrizzleCustomerRepository(db),
    schedule: new DrizzleScheduleRepository(db),
    appointments: new DrizzleAppointmentRepository(db),
    now: () => new Date(),
  };
  return {
    getCatalog: new GetCatalogUseCase(deps),
    getAvailableSlots: new GetAvailableSlotsUseCase(deps),
    createAppointment: new CreateAppointmentUseCase(deps),
  };
}
