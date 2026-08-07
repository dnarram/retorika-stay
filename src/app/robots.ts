import type { MetadataRoute } from "next";

/* Guides are never indexed: they carry the door code of a real home. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/g/", "/panel/", "/api/"] }],
  };
}
