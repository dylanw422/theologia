import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

// The only public, indexable page is the marketing landing page — /chat,
// /profile, /sign-in, /sign-up are private app views excluded via robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
