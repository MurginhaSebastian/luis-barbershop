// Se lee al compilar; en Railway las variables existen también en el build.
export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
