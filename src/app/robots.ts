import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/newsroom", "/moderation", "/settings"],
      },
    ],
    sitemap: "https://niseko-gazet.com/sitemap.xml",
  };
}
