import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Service } from "@/core/entities/catalog";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/core/entities/site";
import { InvalidImageError, NotFoundError } from "@/core/errors/domain-errors";
import { ManageSiteUseCase } from "./manage-site";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

function makeDeps() {
  let settings: SiteSettings = structuredClone(DEFAULT_SITE_SETTINGS);
  const services: Service[] = [{ id: "s1", name: "Corte", durationMinutes: 30, priceCents: 3000, active: true, imageUrl: null }];
  const stored = new Set<string>();
  const images = {
    save: vi.fn(async (name: string) => {
      stored.add(`/imagenes/${name}`);
      return `/imagenes/${name}`;
    }),
    remove: vi.fn(async (url: string) => void stored.delete(url)),
  };
  return {
    stored,
    images,
    services,
    current: () => settings,
    deps: {
      siteSettings: {
        get: async () => settings,
        save: async (next: SiteSettings) => void (settings = next),
      },
      services: {
        findByIds: async (ids: readonly string[]) => services.filter((s) => ids.includes(s.id)),
        findAllActive: async () => services,
        findAll: async () => services,
        save: async (s: Service) => void services.splice(0, 1, s),
      },
      images,
      imageOptimizer: { toWebp: vi.fn(async () => WEBP) },
    },
  };
}

let t: ReturnType<typeof makeDeps>;
let site: ManageSiteUseCase;

beforeEach(() => {
  t = makeDeps();
  site = new ManageSiteUseCase(t.deps);
});

describe("fotos de la portada", () => {
  test("guarda la foto reducida con un nombre nuevo y la asigna a su hueco", async () => {
    await site.setImage("hero", JPEG);
    const url = t.current().images.hero;
    expect(url).toMatch(/^\/imagenes\/[0-9a-f-]{36}\.webp$/);
    expect(t.deps.imageOptimizer.toWebp).toHaveBeenCalledWith(JPEG);
    expect(t.images.save).toHaveBeenCalledWith(expect.any(String), WEBP);
  });

  test("al cambiarla borra la anterior; al quitarla vuelve a la de ejemplo", async () => {
    await site.setImage("hero", JPEG);
    const first = t.current().images.hero as string;
    await site.setImage("hero", JPEG);
    expect(t.stored.has(first)).toBe(false);
    expect(t.stored.size).toBe(1);

    await site.removeImage("hero");
    expect(t.current().images.hero).toBeUndefined();
    expect(t.stored.size).toBe(0);
  });

  test("no toca el resto de ajustes", async () => {
    await site.saveContact({ whatsapp: "51900000000" });
    await site.setImage("about", JPEG);
    expect(t.current().contact).toEqual({ whatsapp: "51900000000" });
  });

  test("si borrar la foto vieja falla, la nueva igual queda guardada", async () => {
    await site.setImage("hero", JPEG);
    t.images.remove.mockRejectedValueOnce(new Error("sin red"));
    await expect(site.setImage("hero", JPEG)).resolves.toBeUndefined();
    expect(t.current().images.hero).toBeDefined();
  });
});

describe("validación", () => {
  test("lo que no es foto no llega al optimizador ni al almacenamiento", async () => {
    await expect(site.setImage("hero", new TextEncoder().encode("<script>"))).rejects.toThrow(InvalidImageError);
    expect(t.deps.imageOptimizer.toWebp).not.toHaveBeenCalled();
    expect(t.images.save).not.toHaveBeenCalled();
  });

  test("una foto corrupta se explica en vez de romper", async () => {
    t.deps.imageOptimizer.toWebp.mockRejectedValueOnce(new Error("Input buffer has corrupt header"));
    await expect(site.setImage("hero", JPEG)).rejects.toThrow("No se pudo leer la foto");
    expect(t.current().images.hero).toBeUndefined();
  });

  test("sin almacenamiento configurado lo dice y no cambia nada", async () => {
    const without = new ManageSiteUseCase({ ...t.deps, images: null });
    expect(without.canUploadImages).toBe(false);
    await expect(without.setImage("hero", JPEG)).rejects.toThrow("no tiene dónde guardar fotos");
  });
});

describe("foto de cada servicio", () => {
  test("se guarda en el servicio y reemplazarla borra la anterior", async () => {
    await site.setServiceImage("s1", JPEG);
    const first = t.services[0].imageUrl as string;
    expect(first).toMatch(/^\/imagenes\//);
    await site.setServiceImage("s1", JPEG);
    expect(t.stored.has(first)).toBe(false);
    expect(t.services[0]).toMatchObject({ name: "Corte", priceCents: 3000 });
  });

  test("quitarla vuelve a la foto de ejemplo", async () => {
    await site.setServiceImage("s1", JPEG);
    await site.removeServiceImage("s1");
    expect(t.services[0].imageUrl).toBeNull();
    expect(t.stored.size).toBe(0);
  });

  test("un servicio que no existe se avisa sin guardar la foto", async () => {
    await expect(site.setServiceImage("nada", JPEG)).rejects.toThrow(NotFoundError);
    expect(t.images.save).not.toHaveBeenCalled();
  });
});
