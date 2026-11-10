import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidSettingsError } from "@/core/errors/domain-errors";
import { removeImageAction, saveContactAction, saveSectionsAction, uploadImageAction } from "./site-actions";
import { parseContactForm, parseImageTarget, parseSectionsForm } from "./site-schema";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  requirePanelSession: vi.fn(),
  saveContact: vi.fn(),
  saveSections: vi.fn(),
  setImage: vi.fn(),
  setServiceImage: vi.fn(),
  removeImage: vi.fn(),
  removeServiceImage: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("./session", () => ({ requirePanelSession: mocks.requirePanelSession }));
vi.mock("@/infrastructure/container", () => ({
  getUseCases: () => ({
    manageSite: {
      saveContact: mocks.saveContact,
      saveSections: mocks.saveSections,
      setImage: mocks.setImage,
      setServiceImage: mocks.setServiceImage,
      removeImage: mocks.removeImage,
      removeServiceImage: mocks.removeServiceImage,
    },
  }),
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

const SERVICE = "20000000-0000-4000-8000-000000000001";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

function upload(target: string, file?: File) {
  const f = new FormData();
  f.append("target", target);
  if (file) f.append("file", file);
  return f;
}

test("parseImageTarget acepta huecos y servicios, y nada más", () => {
  expect(parseImageTarget("hero")).toEqual({ kind: "slot", slot: "hero" });
  expect(parseImageTarget(`service:${SERVICE}`)).toEqual({ kind: "service", serviceId: SERVICE });
  for (const bad of ["fondo", "service:1 OR 1=1", SERVICE, "service:", null]) expect(parseImageTarget(bad)).toBeNull();
});

describe("fotos", () => {
  test("sin sesión no se sube ni se quita nada", async () => {
    mocks.requirePanelSession.mockRejectedValue(new Error("REDIRECT /panel/entrar"));
    await expect(uploadImageAction({}, upload("hero", new File([JPEG], "a.jpg")))).rejects.toThrow("REDIRECT");
    await expect(removeImageAction({}, upload("hero"))).rejects.toThrow("REDIRECT");
    for (const fn of [mocks.setImage, mocks.setServiceImage, mocks.removeImage, mocks.removeServiceImage]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  test("sube al hueco o al servicio indicado", async () => {
    expect(await uploadImageAction({}, upload("hero", new File([JPEG], "a.jpg")))).toEqual({ ok: "Foto actualizada. Ya se ve en la web." });
    expect(mocks.setImage).toHaveBeenCalledWith("hero", JPEG);
    await uploadImageAction({}, upload(`service:${SERVICE}`, new File([JPEG], "a.jpg")));
    expect(mocks.setServiceImage).toHaveBeenCalledWith(SERVICE, JPEG);
  });

  test("sin archivo, con uno enorme o con destino inventado no llama al caso de uso", async () => {
    expect((await uploadImageAction({}, upload("hero"))).error).toBe("Elige una foto.");
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.jpg");
    expect((await uploadImageAction({}, upload("hero", big))).error).toContain("5 MB");
    expect((await uploadImageAction({}, upload("../etc", new File([JPEG], "a.jpg")))).error).toBeDefined();
    expect(mocks.setImage).not.toHaveBeenCalled();
  });

  test("quitar vuelve a la de ejemplo", async () => {
    expect(await removeImageAction({}, upload(`service:${SERVICE}`))).toEqual({ ok: "Vuelve a verse la foto de ejemplo." });
    expect(mocks.removeServiceImage).toHaveBeenCalledWith(SERVICE);
  });
});
