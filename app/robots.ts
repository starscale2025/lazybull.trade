import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt used to 404. That matters more here than on a typical site: the
// go-to-market plan is built on directory submissions, Product Hunt and
// AI-search citation, and every one of those starts with a crawler.
//
// Disallowed paths are the ones that are either per-user or not content:
// /api/* is JSON, /admin is gated, /auth is a sign-in flow, and /portfolio is
// someone's paper account.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/auth/", "/portfolio"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
