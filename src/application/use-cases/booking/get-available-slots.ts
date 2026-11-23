import { totalDuration } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";
import { addDays, bookingWindow, shopDateOf } from "@/core/scheduling/availability";
import { type AvailabilityDeps, type BarberSlots, findFreeSlotsByBarber, loadBookableServices } from "./availability";

export interface GetAvailableSlotsInput {
  /** null = sin preferencia: horas en las que algún barbero está libre. */
  barberId: string | null;
  serviceIds: readonly string[];
  /** Día en el calendario de la barbería, "YYYY-MM-DD". */
  date: string;
}

export interface SlotAlternatives {
  otherBarbers: { barberId: string; name: string; slots: TimeSlot[] }[];
  nextFree: { date: string; slots: TimeSlot[] } | null;
}

/** Une los huecos de varios barberos sin repetir inicios, en orden. */
function unionSlots(byBarber: readonly BarberSlots[]): TimeSlot[] {
  const byStart = new Map(byBarber.flatMap((b) => b.slots).map((slot) => [slot.start.getTime(), slot]));
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export class GetAvailableSlotsUseCase {
  constructor(private readonly deps: AvailabilityDeps) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const services = await loadBookableServices(this.deps.services, input.serviceIds);
    const byBarber = await findFreeSlotsByBarber(this.deps, input.barberId, input.date, totalDuration(services));
    return unionSlots(byBarber);
  }

  /** Qué ofrecer cuando no quedan horas: otros barberos ese día y el próximo día con horas dentro de la ventana. */
  async alternatives(input: GetAvailableSlotsInput): Promise<SlotAlternatives> {
    const services = await loadBookableServices(this.deps.services, input.serviceIds);
    const duration = totalDuration(services);

    let otherBarbers: SlotAlternatives["otherBarbers"] = [];
    if (input.barberId) {
      const others = (await findFreeSlotsByBarber(this.deps, null, input.date, duration)).filter(
        (b) => b.barberId !== input.barberId && b.slots.length > 0,
      );
      // El dueño es el último recurso: solo se ofrece si ningún otro barbero tiene horas.
      const nonOwners = others.filter((b) => !b.isOwner);
      otherBarbers = (nonOwners.length > 0 ? nonOwners : others).map(({ barberId, name, slots }) => ({
        barberId,
        name,
        slots,
      }));
    }

    const last = shopDateOf(bookingWindow(this.deps.now()).notAfter);
    for (let date = addDays(input.date, 1); date <= last; date = addDays(date, 1)) {
      const slots = unionSlots(await findFreeSlotsByBarber(this.deps, input.barberId, date, duration));
      if (slots.length > 0) return { otherBarbers, nextFree: { date, slots } };
    }
    return { otherBarbers, nextFree: null };
  }
}
