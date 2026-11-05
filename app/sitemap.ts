import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_ROUTES } from "@/lib/site";
import { PROBLEMS } from "@/lib/practice/problems";

// /sitemap.xml used to 404. The practice problem pages are generated from the
// same registry that generates the routes themselves, so a new problem is
// crawlable the day it ships without anyone remembering to add it here.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const fixed = PUBLIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  const problems = PROBLEMS.map((p) => ({
    url: `${SITE_URL}/practice/${p.id}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
  return [...fixed, ...problems];
}
