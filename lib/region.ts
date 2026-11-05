// Region + the Indian-securities data-lag policy, in one place.
//
// WHY THIS EXISTS. SEBI's circular of 8 May 2026 (effective 1 July 2026) sets a
// uniform 30-DAY LAG for sharing and using price data for education by
// unregistered persons. lazybull is exactly that: an unregistered, paper-only
// education workbench, and India is its beginner funnel. A live-price paper
// simulator does not fit that channel — so Indian price data served here must
// be at least 30 days old, and labelled as such. The diligence memo's ask,
// verbatim: "Serve Indian users 30-day-lagged or synthetic prices; label it."
//
// WHICH RULE, EXACTLY. The lag applies to INDIAN SECURITIES regardless of who
// is looking. Two readings were possible:
//   (a) lag Indian securities for everyone, or
//   (b) lag every security for viewers located in India.
// (a) is the conservative reading of "price data for education" — the circular
// governs the DATA (NSE/BSE prices), not the viewer — and it is the simpler rule:
// no geo-IP dependency on the data path, no VPN edge cases, no "why does my
// NIFTY quote differ from my friend's", and nothing in the cache keyed by
// viewer. US/UK securities stay live for everyone. Viewer region (below) is
// therefore INFORMATIONAL ONLY: it drives banner copy, never the data.
//
// 31 not 30: one day of margin over the circular's floor, so a clock-skew or
// timezone off-by-one on either side can never produce a 29-day-old bar.

export const LAG_DAYS = 31;
export const LAG_MS = LAG_DAYS * 86_400_000;
/** Stamped onto every lagged response so the UI can name the rule, not just "delayed". */
export const LAG_POLICY = "sebi-education-lag-31d" as const;
export type LagPolicy = typeof LAG_POLICY;

// Yahoo Finance India index codes. The prefix rules below catch the whole
// ^CNX* / ^NSE* / ^BSE* families (Nifty sector indices, BSE size indices);
// these are the ones that do not share a prefix.
const INDIA_INDEX_CODES = new Set([
  "^NSEI", // Nifty 50
  "^NSEBANK", // Bank Nifty
  "^BSESN", // Sensex
  "^CNXIT", // Nifty IT
  "^INDIAVIX", // India VIX
  "^NSMIDCP", // Nifty Midcap
  "^CRSLDX", // Nifty 500
  "^NSEMDCP50", // Nifty Midcap 50
  "^CNX100",
  "^CNX200",
  "^CNX500",
]);
const INDIA_INDEX_PREFIXES = ["^CNX", "^NSE", "^BSE", "^INDIAVIX", "^CRSLDX", "^NIFTY"];
// Bare names people type (and the derivatives' underlying names).
const INDIA_NAMES = /^\^?(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|NIFTYNXT50|SENSEX|BANKEX|INDIAVIX)(\d*)$/;

/**
 * Is this symbol an Indian security under the lag policy? Case-insensitive.
 *   • NSE/BSE listings: anything ending in .NS or .BO
 *   • Yahoo India index codes (^NSEI, ^NSEBANK, ^BSESN, ^CNXIT, ^CNX*, ^BSE*…)
 *   • bare names: NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCPNIFTY, …
 *   • anything carrying "NIFTY" (NIFTY_FIN_SERVICE.NS and friends)
 */
export function isIndianSecurity(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  if (s.endsWith(".NS") || s.endsWith(".BO")) return true;
  if (INDIA_INDEX_CODES.has(s)) return true;
  if (INDIA_INDEX_PREFIXES.some((p) => s.startsWith(p))) return true;
  if (INDIA_NAMES.test(s)) return true;
  if (s.includes("NIFTY") || s.includes("SENSEX")) return true;
  return false;
}

/** The newest bar time (epoch ms) the policy allows to be shown at `now`. */
export function lagCutoff(now: number = Date.now()): number {
  return now - LAG_MS;
}

/** What a lagged response carries so the UI can label it honestly. */
export type LagStamp = {
  delayed: true;
  /** Epoch ms of the newest bar that survived the cut (null = nothing survived). */
  asOf: number | null;
  policy: LagPolicy;
  lagDays: number;
};

/**
 * Apply the lag policy to a bar series. For Indian securities, DROP every bar
 * with t > now − 31 days (bars are epoch ms, oldest first), re-index, and
 * return a stamp; for everything else the input array is returned as-is (same
 * reference) with a null stamp, so non-Indian symbols cost nothing.
 *
 * Applied on READ, never on write: the cache holds the raw series and the cut
 * moves with the clock, so a cached entry can never leak a newer bar as the
 * days roll over — and a warm cache never freezes the cutoff.
 */
export function applyLagPolicy<B extends { t: number }>(
  bars: B[],
  symbol: string,
  now: number = Date.now()
): { bars: B[]; lag: LagStamp | null } {
  if (!isIndianSecurity(symbol)) return { bars, lag: null };
  const cutoff = lagCutoff(now);
  const kept = bars.filter((b) => Number.isFinite(b.t) && b.t <= cutoff);
  // Re-index `i` so chart code that walks by index sees a contiguous series.
  const reindexed = kept.map((b, i) => ("i" in b ? { ...b, i } : b));
  return {
    bars: reindexed,
    lag: {
      delayed: true,
      asOf: reindexed.length ? reindexed[reindexed.length - 1].t : null,
      policy: LAG_POLICY,
      lagDays: LAG_DAYS,
    },
  };
}

/** Human label for the provenance badge — one string so every surface agrees. */
export const LAG_LABEL = `delayed ${LAG_DAYS} d · SEBI education norms`;

// ── viewer region (informational only — see the header) ─────────────────────

const ISO2 = /^[A-Z]{2}$/;

/**
 * Viewer country as ISO-2, or null. Vercel sets `x-vercel-ip-country` at the
 * edge; `LAZYBULL_FORCE_REGION` overrides it for local testing of region copy
 * (there is no geo header on localhost). Never PII: a country code only.
 */
export function regionFromHeaders(headers: Headers): string | null {
  const forced = (process.env.LAZYBULL_FORCE_REGION || "").trim().toUpperCase();
  if (ISO2.test(forced)) return forced;
  const h = (headers.get("x-vercel-ip-country") || "").trim().toUpperCase();
  return ISO2.test(h) ? h : null;
}
