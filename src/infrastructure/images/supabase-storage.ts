import type { IImageStorage } from "@/application/ports/images";

const FILE_NAME = /^[0-9a-f-]{36}\.webp$/;

export interface SupabaseStorageConfig {
  /** https://<proyecto>.supabase.co */
  url: string;
  /** Clave service_role: solo en el servidor, nunca en una variable NEXT_PUBLIC_*. */
  serviceKey: string;
  /** Bucket público donde se guardan las fotos. */
  bucket: string;
}

/** Supabase Storage por su API REST, sin SDK. El bucket debe ser público para que la web muestre las fotos. */
export class SupabaseImageStorage implements IImageStorage {
  constructor(
    private readonly config: SupabaseStorageConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get headers() {
    return { Authorization: `Bearer ${this.config.serviceKey}`, apikey: this.config.serviceKey };
  }

  private publicUrl(name: string) {
    return `${this.config.url}/storage/v1/object/public/${this.config.bucket}/${name}`;
  }

  async save(name: string, webp: Uint8Array): Promise<string> {
    if (!FILE_NAME.test(name)) throw new Error(`Nombre de foto no válido: ${name}`);
    const response = await this.fetchImpl(`${this.config.url}/storage/v1/object/${this.config.bucket}/${name}`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "image/webp", "Cache-Control": "max-age=31536000", "x-upsert": "false" },
      body: new Blob([webp as BlobPart], { type: "image/webp" }),
    });
    if (!response.ok) throw new Error(`Supabase Storage no guardó la foto (${response.status}).`);
    return this.publicUrl(name);
  }

  async remove(url: string): Promise<void> {
    const prefix = this.publicUrl("");
    const name = url.startsWith(prefix) ? url.slice(prefix.length) : "";
    if (!FILE_NAME.test(name)) return;
    const response = await this.fetchImpl(`${this.config.url}/storage/v1/object/${this.config.bucket}`, {
      method: "DELETE",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [name] }),
    });
    if (!response.ok) throw new Error(`Supabase Storage no borró la foto (${response.status}).`);
  }
}
