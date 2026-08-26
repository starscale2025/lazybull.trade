// The canonical origin, in one place.
//
// Needed by three things that all have to agree or they quietly disagree in
// production: metadataBase (which resolves every relative OG/canonical URL),
// robots.ts, and sitemap.ts. Reads NEXT_PUBLIC_SITE_URL so preview deploys
// advertise themselves rather than the production host, and falls back to the
// real origin so a missing env var can never emit "localhost" into a sitemap.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lazybull.trade"
).replace(/\/$/, "");

/**
 * Public, indexable routes. Deliberately hand-maintained rather than globbed
 * off the filesystem: /admin, /auth, /portfolio and every /api route are real
 * pages that must NOT be advertised, and a glob would need a denylist that
 * drifts. Adding a public page? Add it here.
 */
export const PUBLIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/learn", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/trade", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/trade/chain", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/quant", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/pro", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/greeks", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/learn/bots", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/learn/broken-vwap", priority: 0.5, changeFrequency: "yearly" as const },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/safety", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/graveyard", priority: 0.3, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
];
