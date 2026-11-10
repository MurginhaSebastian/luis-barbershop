import { getLocalImages } from "@/infrastructure/container";

/** Fotos subidas al disco local; con Supabase Storage se sirven desde allí y esta ruta no se usa. */
export async function GET(_request: Request, ctx: RouteContext<"/imagenes/[archivo]">) {
  const { archivo } = await ctx.params;
  const bytes = await getLocalImages().read(archivo);
  if (!bytes) return new Response("Foto no encontrada", { status: 404 });
  return new Response(new Blob([bytes as BlobPart]), {
    // El nombre es único por foto: si cambia la foto, cambia la URL.
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
