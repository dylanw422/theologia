import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

// /chat and /profile are the private app views (conversations, personal
// theological data) and /sign-in, /sign-up have no SEO value — none of
// them belong in search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/chat", "/profile", "/sign-in", "/sign-up", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
