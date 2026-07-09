import type { MetadataRoute } from "next";

const BASE = "https://hailscout.net";

/** Allow crawling the public marketing + storm pages; keep the authenticated
 *  app out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/sign-in"] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
