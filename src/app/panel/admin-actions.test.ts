import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidCatalogError } from "@/core/errors/domain-errors";
import {
  addBlockAction,
  removeBlockAction,
  saveBarberAction,
  saveDayHoursAction,
  saveProductAction,
  saveServiceAction,
} from "./admin-actions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  requirePanelSession: vi.fn(),
  saveService: vi.fn(),
  saveProduct: vi.fn(),
  saveBarber: vi.fn(),
  saveDayHours: vi.fn(),
  addBlock: vi.fn(),
  removeBlock: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("./session", () => ({ requirePanelSession: mocks.requirePanelSession }));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({
    manageCatalog: { saveService: mocks.saveService, saveProduct: mocks.saveProduct, saveBarber: mocks.saveBarber },
    manageSchedule: { saveDayHours: mocks.saveDayHours, addBlock: mocks.addBlock, removeBlock: mocks.removeBlock },
  }),
}));

const ID = "20000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const service = form({ name: "Corte", durationMinutes: "30", price: "30", active: "on" });
const product = form({ name: "Cera", price: "25", active: "on" });
const barber = form({ name: "Luis", active: "on" });
const hours = form({ weekday: "1", open1: "10:00", close1: "14:00" });
const block = form({ from: "2026-11-02", to: "2026-11-02" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePanelSession.mockResolvedValue(undefined);
  mocks.saveBarber.mockResolvedValue({ upcoming: 0 });
  mocks.addBlock.mockResolvedValue({ conflicts: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sin sesión ninguna acción cambia nada", () => {
  test.each([
    ["saveServiceAction", () => saveServiceAction({}, service)],
    ["saveProductAction", () => saveProductAction({}, product)],
    ["saveBarberAction", () => saveBarberAction({}, barber)],
    ["saveDayHoursAction", () => saveDayHoursAction({}, hours)],
    ["addBlockAction", () => addBlockAction({}, block)],
    ["removeBlockAction", () => removeBlockAction(ID)],
  ])("%s", async (_, action) => {
    mocks.requirePanelSession.mockRejectedValue(new Error("REDIRECT /panel/entrar"));
    await expect(action()).rejects.toThrow("REDIRECT");
    for (const write of [mocks.saveService, mocks.saveProduct, mocks.saveBarber, mocks.saveDayHours, mocks.addBlock, mocks.removeBlock]) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});

describe("con sesión", () => {
  test("guardar pasa los datos ya validados y refresca", async () => {
    expect(await saveServiceAction({}, service)).toEqual({ ok: "Guardado." });
    expect(mocks.saveService).toHaveBeenCalledWith(expect.objectContaining({ name: "Corte", priceCents: 3000, active: true }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("lo mal escrito no llega al caso de uso", async () => {
    const { error } = await saveServiceAction({}, form({ name: "Corte", durationMinutes: "30", price: "gratis" }));
    expect(error).toContain("precio");
    expect(mocks.saveService).not.toHaveBeenCalled();
  });

  test("ocultar un barbero con citas avisa", async () => {
    mocks.saveBarber.mockResolvedValue({ upcoming: 3 });
    expect((await saveBarberAction({}, barber)).warning).toContain("3 citas por venir");
    mocks.saveBarber.mockResolvedValue({ upcoming: 1 });
    expect((await saveBarberAction({}, barber)).warning).toContain("1 cita por venir");
  });

  test("un bloqueo que pisa citas avisa de que no se cancelan solas", async () => {
    mocks.addBlock.mockResolvedValue({ conflicts: 2 });
    const state = await addBlockAction({}, block);
    expect(state.ok).toBe("Bloqueo añadido.");
    expect(state.warning).toContain("no se cancelan solas");
  });

  test("un bloqueo con el fin antes del inicio se explica", async () => {
    const state = await addBlockAction({}, form({ from: "2026-11-03", to: "2026-11-02" }));
    expect(state.error).toBeDefined();
    expect(mocks.addBlock).not.toHaveBeenCalled();
  });

  test("quitar un bloqueo exige un id válido", async () => {
    expect((await removeBlockAction("1 OR 1=1")).error).toBeDefined();
    expect(mocks.removeBlock).not.toHaveBeenCalled();
    expect(await removeBlockAction(ID)).toEqual({ ok: "Bloqueo eliminado." });
  });

  test("muestra los errores de negocio y no refresca", async () => {
    mocks.saveDayHours.mockRejectedValue(new InvalidCatalogError("Los tramos del día no pueden pisarse."));
    expect(await saveDayHoursAction({}, hours)).toEqual({ error: "Los tramos del día no pueden pisarse." });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  test("un fallo inesperado no filtra detalles internos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.saveProduct.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5433"));
    expect(await saveProductAction({}, product)).toEqual({ error: "No se pudo guardar. Inténtalo de nuevo." });
  });
});
