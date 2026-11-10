import { connection } from "next/server";
import { cache } from "react";
import { getUseCases } from "@/infrastructure/container";

/** Una sola lectura por petición, aunque la pidan la cabecera, la portada y el pie. */
export const getSiteSettings = cache(async () => {
  await connection();
  return getUseCases().manageSite.get();
});
