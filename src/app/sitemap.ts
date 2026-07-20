import type { MetadataRoute } from "next";

import { docPages } from "@/lib/docs";
import { siteConfig } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/features", "/pricing", "/docs"].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
  }));

  const docRoutes = docPages.map((doc) => ({
    url: `${siteConfig.url}/docs/${doc.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...docRoutes];
}
