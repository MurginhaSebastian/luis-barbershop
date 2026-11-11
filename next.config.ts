import type { NextConfig } from "next";

// Las páginas tienen partes prerenderizadas, que no admiten nonce: por eso 'unsafe-inline' en scripts.
// shortcut: solo en producción; `next dev` necesita eval y websockets para recargar.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// El service worker de los avisos: siempre la última versión y sin permisos de más.
const serviceWorkerHeaders = [
  { key: "Content-Type", value: "application/javascript; charset=utf-8" },
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
];

// Video y fotos de ejemplo: una semana en caché. Para cambiarlos al momento, se sube un archivo con otro nombre.
const mediaCache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];

// Las fotos subidas a Supabase Storage pasan por el optimizador de Next: así se sirven desde la propia web
// y la política de contenido no tiene que admitir otro dominio.
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  experimental: {
    // Fotos de hasta 5 MB más el sobrante del formulario multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    const always = [
      { source: "/sw.js", headers: serviceWorkerHeaders },
      { source: "/videos/:file*", headers: mediaCache },
      { source: "/images/:file*", headers: mediaCache },
    ];
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", headers: securityHeaders }, ...always] : always;
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
