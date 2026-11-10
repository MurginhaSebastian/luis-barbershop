import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidSettingsError } from "@/core/errors/domain-errors";
import { saveContactAction, saveSectionsAction } from "./site-actions";
import { parseContactForm, parseSectionsForm } from "./site-schema";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  requirePanelSession: vi.fn(),
  saveContact: vi.fn(),
  saveSections: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("./session", () => ({ requirePanelSession: mocks.requirePanelSession }));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({ manageSite: { saveContact: mocks.saveContact, saveSections: mocks.saveSections } }),
}));

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePanelSession.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseContactForm", () => {
  test("normaliza el WhatsApp y descarta lo vacío", () => {
    const parsed = parseContactForm(form({ whatsapp: "900 000 000", address: "  ", mapsUrl: " https://maps.google.com/?q=Lima " }));
    expect(parsed.success && parsed.data).toEqual({ whatsapp: "51900000000", mapsUrl: "https://maps.google.com/?q=Lima" });
  });

  test("todo vacío deja el contacto vacío", () => {
    const parsed = parseContactForm(form({ whatsapp: "", address: "", instagramUrl: "" }));
    expect(parsed.success && parsed.data).toEqual({});
  });

  test("rechaza campos enormes antes de llegar a la base", () => {
    expect(parseContactForm(form({ address: "x".repeat(501) })).success).toBe(false);
  });
});

test("parseSectionsForm: lo no marcado queda oculto", () => {
  expect(parseSectionsForm(form({ about: "on", visit: "on" }))).toEqual({
    about: true,
    whyUs: false,
    howToBook: false,
    products: false,
    visit: true,
  });
});

describe("acciones", () => {
  test("sin sesión no guardan nada", async () => {
    mocks.requirePanelSession.mockRejectedValue(new Error("REDIRECT /panel/entrar"));
    await expect(saveContactAction({}, form({ whatsapp: "900000000" }))).rejects.toThrow("REDIRECT");
    await expect(saveSectionsAction({}, form({}))).rejects.toThrow("REDIRECT");
    expect(mocks.saveContact).not.toHaveBeenCalled();
    expect(mocks.saveSections).not.toHaveBeenCalled();
  });

  test("con sesión guardan y refrescan", async () => {
    expect(await saveContactAction({}, form({ whatsapp: "900000000" }))).toEqual({ ok: "Guardado. Ya se ve en la web." });
    expect(mocks.saveContact).toHaveBeenCalledWith({ whatsapp: "51900000000" });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  test("un enlace peligroso se explica y no refresca", async () => {
    mocks.saveContact.mockRejectedValue(new InvalidSettingsError("Los enlaces deben empezar por https://."));
    expect(await saveContactAction({}, form({ mapsUrl: "javascript:alert(1)" }))).toEqual({
      error: "Los enlaces deben empezar por https://.",
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
