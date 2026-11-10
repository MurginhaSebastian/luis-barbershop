import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IImageStorage } from "@/application/ports/images";

export const LOCAL_IMAGES_URL = "/imagenes/";
// Solo nombres generados por nosotros: impide leer o borrar fuera de la carpeta con "../".
const FILE_NAME = /^[0-9a-f-]{36}\.webp$/;

// shortcut: disco del servidor; en un hosting sin disco persistente (Vercel) se usa Supabase Storage.
export class LocalImageStorage implements IImageStorage {
  constructor(private readonly dir: string) {}

  async save(name: string, webp: Uint8Array): Promise<string> {
    if (!FILE_NAME.test(name)) throw new Error(`Nombre de foto no válido: ${name}`);
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, name), webp);
    return LOCAL_IMAGES_URL + name;
  }

  async remove(url: string): Promise<void> {
    const name = url.startsWith(LOCAL_IMAGES_URL) ? url.slice(LOCAL_IMAGES_URL.length) : "";
    if (!FILE_NAME.test(name)) return;
    await unlink(path.join(this.dir, name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async read(name: string): Promise<Uint8Array | null> {
    if (!FILE_NAME.test(name)) return null;
    return readFile(path.join(this.dir, name)).then(
      (buffer) => new Uint8Array(buffer),
      () => null,
    );
  }
}
