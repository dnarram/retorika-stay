import type { MetadataRoute } from "next";

/* Las guías nunca se indexan: llevan el código de la puerta de una casa real. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/g/", "/panel/", "/api/"] }],
  };
}
