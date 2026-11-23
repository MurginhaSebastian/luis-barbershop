import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/api/", "/reservar"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
