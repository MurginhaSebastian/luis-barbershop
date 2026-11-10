import { describe, expect, test, vi } from "vitest";
import { LocalImageStorage } from "./local-storage";
import { selectImageStorage } from "./select-storage";
import { SupabaseImageStorage } from "./supabase-storage";

const config = { url: "https://proyecto.supabase.co", serviceKey: "clave-servicio", bucket: "fotos" };
const NAME = "00000000-0000-4000-8000-000000000001.webp";
const PUBLIC = `https://proyecto.supabase.co/storage/v1/object/public/fotos/${NAME}`;

function storage(status = 200) {
  const fetchImpl = vi.fn(async () => new Response("{}", { status }));
  return { fetchImpl, storage: new SupabaseImageStorage(config, fetchImpl as unknown as typeof fetch) };
}

describe("SupabaseImageStorage", () => {
  test("sube con la clave de servicio y devuelve la URL pública", async () => {
    const { fetchImpl, storage: s } = storage();
    expect(await s.save(NAME, new Uint8Array([1, 2, 3]))).toBe(PUBLIC);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://proyecto.supabase.co/storage/v1/object/fotos/${NAME}`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer clave-servicio", "Content-Type": "image/webp", "x-upsert": "false" });
    expect(new Uint8Array(await (init.body as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("si Supabase rechaza la subida, falla en vez de guardar una URL rota", async () => {
    await expect(storage(403).storage.save(NAME, new Uint8Array([1]))).rejects.toThrow("403");
  });

  test("borra solo fotos suyas y por su nombre", async () => {
    const { fetchImpl, storage: s } = storage();
    await s.remove(PUBLIC);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proyecto.supabase.co/storage/v1/object/fotos");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ prefixes: [NAME] });

    await s.remove("/images/hero.jpg");
    await s.remove("https://otro.sitio/storage/v1/object/public/fotos/" + NAME);
    await s.remove(`https://proyecto.supabase.co/storage/v1/object/public/fotos/../secreto.webp`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("no sube nombres que no generó la web", async () => {
    await expect(storage().storage.save("../x.webp", new Uint8Array([1]))).rejects.toThrow();
  });
});

describe("selectImageStorage", () => {
  const supabase = { SUPABASE_URL: "https://proyecto.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "k", SUPABASE_BUCKET: "fotos" };

  test("con Supabase configurado lo usa, aunque sea producción", () => {
    expect(selectImageStorage({ ...supabase, NODE_ENV: "production" })).toBeInstanceOf(SupabaseImageStorage);
  });

  test("en desarrollo, o con IMAGE_STORAGE=local, usa el disco", () => {
    expect(selectImageStorage({ NODE_ENV: "development" })).toBeInstanceOf(LocalImageStorage);
    expect(selectImageStorage({ NODE_ENV: "production", IMAGE_STORAGE: "local" })).toBeInstanceOf(LocalImageStorage);
    expect(selectImageStorage({ ...supabase, NODE_ENV: "production", IMAGE_STORAGE: "local" })).toBeInstanceOf(LocalImageStorage);
  });

  test("en producción sin nada configurado no ofrece subir fotos", () => {
    expect(selectImageStorage({ NODE_ENV: "production" })).toBeNull();
    expect(selectImageStorage({ NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
  });
});
