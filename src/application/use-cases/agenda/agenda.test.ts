import { beforeEach, describe, expect, test } from "vitest";
import { Appointment, AppointmentStatus } from "@/core/entities/appointment";
import type { TimeSlot } from "@/core/entities/time-slot";
import { InvalidStatusChangeError, NotFoundError } from "@/core/errors/domain-errors";
import { ChangeAppointmentStatusUseCase } from "./change-appointment-status";
import { GetAgendaUseCase } from "./get-agenda";

// Lunes 2026-11-02 en Lima (UTC−5). Datos ficticios.
const NOW = new Date("2026-11-02T14:00:00Z");
const service = { serviceId: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000 };
const product = { productId: "p1", name: "Cera", quantity: 2, unitPriceCents: 2500 };

const book = (id: string, start: string, barberId = "b1") =>
  Appointment.book({
    id,
    barberId,
    customerId: "c1",
    customerName: "Pedro",
    start: new Date(start),
    services: [service],
    products: [product],
  });

function makeRepos(appointments: Appointment[]) {
  return {
    data: appointments,
    appointments: {
      findById: async (id: string) => appointments.find((a) => a.id === id) ?? null,
      findInRange: async (range: TimeSlot) => appointments.filter((a) => a.slot.overlaps(range)),
      findByStatusFrom: async (status: AppointmentStatus, from: Date) =>
        appointments.filter((a) => a.status === status && a.slot.end > from),
      findByBarberInRange: async () => [],
      findByCustomerFrom: async () => [],
      save: async (a: Appointment) => {
        appointments.splice(appointments.findIndex((x) => x.id === a.id), 1, a);
      },
      updateStatus: async (a: Appointment, expected: AppointmentStatus) => {
        const i = appointments.findIndex((x) => x.id === a.id && x.status === expected);
        if (i < 0) return false;
        appointments.splice(i, 1, a);
        return true;
      },
    },
    customers: {
      findByIds: async () => [{ id: "c1", name: "María", phone: "51900000001" }],
      findByPhone: async () => null,
      save: async (c: { id: string; name: string; phone: string }) => c,
    },
    barbers: {
      findByIds: async () => [
        { id: "b1", name: "Luis", active: true },
        { id: "b2", name: "Antiguo", active: false },
      ],
      findById: async () => null,
      findAllActive: async () => [],
      findAll: async () => [],
      save: async () => {},
    },
    confirmations: {
      save: async () => {},
      findByCode: async () => [],
      findOverdue: async () => [],
      findByAppointments: async (ids: readonly string[]) =>
        ids.includes("mañana") ? [{ appointmentId: "mañana", code: "KRT482", confirmBy: new Date("2026-11-02T14:00:00Z") }] : [],
    },
    now: () => NOW,
  };
}

describe("GetAgendaUseCase", () => {
  test("separa lo que falta confirmar de la agenda del día", async () => {
    const later = book("a2", "2026-11-05T15:00:00Z");
    const confirmedToday = book("a1", "2026-11-02T16:00:00Z").changeStatus(AppointmentStatus.CONFIRMED);
    const repos = makeRepos([later, confirmedToday]);

    const agenda = await new GetAgendaUseCase(repos).execute({ date: "2026-11-02" });
    expect(agenda.pending.map((i) => i.id)).toEqual(["a2"]);
    expect(agenda.day.map((i) => i.id)).toEqual(["a1"]);
  });

  test("ordena por hora y da lo necesario para atender la cita", async () => {
    const repos = makeRepos([book("tarde", "2026-11-02T20:00:00Z"), book("mañana", "2026-11-02T15:00:00Z")]);
    const { day } = await new GetAgendaUseCase(repos).execute({ date: "2026-11-02" });

    expect(day.map((i) => i.id)).toEqual(["mañana", "tarde"]);
    expect(day[0]).toEqual({
      id: "mañana",
      start: "2026-11-02T15:00:00.000Z",
      end: "2026-11-02T15:30:00.000Z",
      status: "PENDING",
      customerName: "Pedro",
      phone: "51900000001",
      barberName: "Luis",
      services: ["Corte"],
      products: ["2 × Cera"],
      totalCents: 8000,
      confirmBy: "2026-11-02T14:00:00.000Z",
    });
    // Sin confirmación por WhatsApp no hay plazo.
    expect(day[1].confirmBy).toBeUndefined();
  });

  test("una cita pasada sin confirmar no se queda en la lista de pendientes", async () => {
    const repos = makeRepos([book("vieja", "2026-11-02T09:00:00Z")]);
    const agenda = await new GetAgendaUseCase(repos).execute({ date: "2026-11-02" });
    expect(agenda.pending).toEqual([]);
    expect(agenda.day.map((i) => i.id)).toEqual(["vieja"]);
  });

  test("muestra el barbero aunque ya no esté activo", async () => {
    const repos = makeRepos([book("a1", "2026-11-02T15:00:00Z", "b2")]);
    const { day } = await new GetAgendaUseCase(repos).execute({ date: "2026-11-02" });
    expect(day[0].barberName).toBe("Antiguo");
  });
});

describe("ChangeAppointmentStatusUseCase", () => {
  let repos: ReturnType<typeof makeRepos>;
  beforeEach(() => {
    repos = makeRepos([book("a1", "2026-11-03T15:00:00Z")]);
  });

  test("guarda el nuevo estado", async () => {
    await new ChangeAppointmentStatusUseCase(repos).execute({ id: "a1", status: AppointmentStatus.CONFIRMED });
    expect(repos.data[0].status).toBe(AppointmentStatus.CONFIRMED);
  });

  test("rechaza un cambio no permitido sin tocar la cita", async () => {
    const change = new ChangeAppointmentStatusUseCase(repos);
    await expect(change.execute({ id: "a1", status: AppointmentStatus.COMPLETED })).rejects.toThrow(InvalidStatusChangeError);
    expect(repos.data[0].status).toBe(AppointmentStatus.PENDING);
  });

  test("si la cita cambió mientras tanto (venció o la confirmó el cliente), no la pisa", async () => {
    const snapshot = repos.data[0];
    repos.data[0] = snapshot.changeStatus(AppointmentStatus.EXPIRED);
    const stale = { ...repos, appointments: { ...repos.appointments, findById: async () => snapshot } };
    await expect(new ChangeAppointmentStatusUseCase(stale).execute({ id: "a1", status: AppointmentStatus.CONFIRMED })).rejects.toThrow(
      InvalidStatusChangeError,
    );
    expect(repos.data[0].status).toBe(AppointmentStatus.EXPIRED);
  });

  test("avisa si la cita no existe", async () => {
    const change = new ChangeAppointmentStatusUseCase(repos);
    await expect(change.execute({ id: "nada", status: AppointmentStatus.CONFIRMED })).rejects.toThrow(NotFoundError);
  });
});
