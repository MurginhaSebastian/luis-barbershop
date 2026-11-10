import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, describe, expect, test } from "vitest";
import { detectImageType } from "@/core/entities/image";
import { LocalImageStorage } from "./local-storage";
import { SharpImageOptimizer } from "./sharp-optimizer";

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } })
    .withExif({ IFD0: { Copyright: "Dueño", Artist: "Móvil de prueba" } })
    .jpeg()
    .toBuffer();

describe("SharpImageOptimizer", () => {
  test("reduce a 1600 px como máximo, convierte a WebP y quita los metadatos", async () => {
    const webp = await new SharpImageOptimizer().toWebp(new Uint8Array(await photo(3000, 2000)));
    expect(detectImageType(webp)).toBe("webp");
    const meta = await sharp(webp).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 1067]);
    expect(meta.exif).toBeUndefined();
  });

  test("no agranda una foto pequeña", async () => {
    const webp = await new SharpImageOptimizer().toWebp(new Uint8Array(await photo(400, 300)));
    expect((await sharp(webp).metadata()).width).toBe(400);
  });

  test("rechaza imágenes con más píxeles de los permitidos", async () => {
    const tiny = new SharpImageOptimizer(100);
    await expect(tiny.toWebp(new Uint8Array(await photo(20, 20)))).rejects.toThrow();
  });

  test("rechaza un archivo que solo aparenta ser imagen", async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    await expect(new SharpImageOptimizer().toWebp(fake)).rejects.toThrow();
  });
});

describe("LocalImageStorage", () => {
  const dir = ".uploads-test";
  const storage = new LocalImageStorage(dir);
  const name = "00000000-0000-4000-8000-000000000001.webp";
  afterAll(() => rm(dir, { recursive: true, force: true }));

  test("guarda, sirve y borra una foto", async () => {
    const url = await storage.save(name, new Uint8Array([1, 2, 3]));
    expect(url).toBe(`/imagenes/${name}`);
    expect(await storage.read(name)).toEqual(new Uint8Array([1, 2, 3]));
    await storage.remove(url);
    expect(await storage.read(name)).toBeNull();
    await expect(storage.remove(url)).resolves.toBeUndefined();
  });

  test("no deja salir de su carpeta ni tocar otros archivos", async () => {
    await expect(storage.save("../package.json", new Uint8Array([1]))).rejects.toThrow();
    expect(await storage.read("../package.json")).toBeNull();
    expect(await storage.read("..%2Fpackage.json")).toBeNull();
    await storage.remove("/imagenes/../package.json");
    await storage.remove("https://otro.sitio/foto.webp");
    expect(existsSync("package.json")).toBe(true);
  });
});
