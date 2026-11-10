import type { IImageStorage } from "@/application/ports/images";
import { LocalImageStorage } from "./local-storage";
import { SupabaseImageStorage } from "./supabase-storage";

/**
 * Supabase Storage si está configurado; si no, el disco del servidor en desarrollo (o con IMAGE_STORAGE=local).
 * En producción sin ninguno de los dos, null: un hosting sin disco persistente perdería las fotos.
 */
export function selectImageStorage(env: NodeJS.ProcessEnv): IImageStorage | null {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET, IMAGE_STORAGE, NODE_ENV } = env;
  if (IMAGE_STORAGE !== "local" && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_BUCKET) {
    return new SupabaseImageStorage({ url: SUPABASE_URL.replace(/\/$/, ""), serviceKey: SUPABASE_SERVICE_ROLE_KEY, bucket: SUPABASE_BUCKET });
  }
  if (IMAGE_STORAGE === "local" || NODE_ENV !== "production") return new LocalImageStorage(env.UPLOADS_DIR || ".uploads");
  return null;
}
