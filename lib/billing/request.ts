// Request-side helpers the billing routes share.

/** Largest webhook body either provider is allowed to post (chars). A real
 *  subscription payload is ~3 KB; 64 KB leaves room for relationships without
 *  letting an unauthenticated POST buffer megabytes before the signature
 *  check can reject it. */
export const MAX_WEBHOOK_BYTES = 64_000;

/**
 * Read the body as text, bounded. `content-length` is client-declared, so the
 * text is re-checked after the read — the two together keep an oversized
 * body out of the HMAC and out of Mongo. Returns null when over the bound.
 */
export async function readBoundedBody(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return null;
  const text = await req.text();
  return text.length > max ? null : text;
}

/**
 * Coarse region for the currency default: "IN" for India, "XX" for any other
 * country Vercel could identify, null when the header is absent (local dev,
 * a self-host without a geo header). Never anything finer than that — this
 * picks the ₹ / $ default and is not stored anywhere but the waitlist row.
 */
export function regionFrom(headers: Headers): "IN" | "XX" | null {
  const c = (headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return c === "IN" ? "IN" : "XX";
}

/** The two-letter code itself, for the waitlist row's `region`. */
export function countryFrom(headers: Headers): string | null {
  const c = (headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}
