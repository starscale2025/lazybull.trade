// Shareable trades — the one near-zero-cost growth loop the plan called for.
//
// WHY THIS EXISTS. The diligence memo's growth section, verbatim: "No
// shareable 'copy this trade' card / deep link". Everything else in the plan
// costs money per user; this costs a URL. Someone builds a position, copies a
// link, and the person who opens it lands on the same position rebuilt in
// their own (paper) builder, with a payoff-curve OG card in the message they
// clicked from.
//
// THE FORMAT. Not base64 JSON — that is 250+ characters for four legs, it
// looks like an opaque blob in a chat window, and it invites the reader to
// think something private is inside. This is a short, unreserved-character,
// human-readable string:
//
//     1~AMZN~226.45~35~bc230-1-5.2_sc240-1-2.1
//     │  │     │      │  └ legs, "_"-separated
//     │  │     │      └ days to expiry
//     │  │     └ spot when it was shared (the payoff curve needs an anchor)
//     │  └ underlying
//     └ format version
//
//     leg := <b|s><c|p><strike>-<qty>-<premium>
//
// Every character is RFC 3986 unreserved (`- . _ ~` plus alphanumerics), so it
// survives encodeURIComponent unchanged and no chat client mangles it. A
// four-leg iron condor is ~85 characters, well inside the ~200 budget.
//
// NEVER TRUST THE URL. decodeLegs() is the only way in, it is zod-validated
// against bounds on every field, and it returns null — never a partial trade,
// never a thrown error — for anything malformed, out of range, over length, or
// carrying more legs than this product builds. Both readers (the /trade page
// and the OG image route) go through it, so there is one place where a hostile
// string is stopped.
//
// WHAT IS NOT IN IT: no user id, no device id, no timestamp, no account state.
// A shared link says what the position is and nothing about who built it.

import { z } from "zod";
import type { Leg, OptionType } from "./pricing";
import { SITE_URL } from "./site";

export const SHARE_VERSION = 1 as const;
/** Hard cap on the `t=` parameter. Four legs is ~85 chars; this is the bound. */
export const MAX_SHARE_PARAM = 240;
/**
 * The widest shape this builder makes is a four-leg iron condor. A link
 * claiming more is not a trade this product can rebuild, so it is refused
 * rather than half-rendered.
 */
export const MAX_SHARE_LEGS = 4;

/** A leg as the builder holds it — Strategy["legs"][number] fits without a cast. */
export type SharedLegInput = {
  type: OptionType;
  side: "long" | "short";
  strike: number;
  qty: number;
  premium: number;
};

export type SharedTradeInput = {
  underlying: string;
  /** Spot at share time — the payoff curve is drawn around it. */
  spot: number;
  daysToExpiry: number;
  legs: SharedLegInput[];
};

/** What decodeLegs() returns: validated, with ids so pnlCurve/detect accept it. */
export type SharedTrade = {
  v: typeof SHARE_VERSION;
  underlying: string;
  spot: number;
  daysToExpiry: number;
  legs: Leg[];
};

// Bounds. Generous enough for a ₹-priced index and a $6,000 SPX strike, tight
// enough that no field can carry a payload.
const SharedLegSchema = z.object({
  type: z.enum(["C", "P"]),
  side: z.enum(["long", "short"]),
  strike: z.number().gt(0).lte(1_000_000),
  qty: z.number().int().min(1).max(100),
  premium: z.number().min(0).lte(1_000_000),
});

const SharedTradeSchema = z.object({
  v: z.literal(SHARE_VERSION),
  // Uppercase tickers, including Yahoo's `.NS` suffixes and `^`-prefixed
  // indices. No lowercase, no spaces, no slashes: this is a symbol, not a path.
  underlying: z.string().regex(/^[A-Z0-9.^_-]{1,12}$/),
  spot: z.number().gt(0).lte(10_000_000),
  daysToExpiry: z.number().int().min(0).max(3650),
  legs: z.array(SharedLegSchema).min(1).max(MAX_SHARE_LEGS),
});

/** Two decimal places, no trailing zeros: 226.45, 5.2, 230. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** `<b|s><c|p><strike>-<qty>-<premium>` */
const LEG_RE = /^([bs])([cp])(\d{1,9}(?:\.\d{1,2})?)-(\d{1,3})-(\d{1,9}(?:\.\d{1,2})?)$/;

/**
 * Encode a shared trade: the legs plus the context they are meaningless
 * without (underlying, the spot they were priced against, days to expiry).
 * Returns "" when the input cannot make a valid link — callers hide the
 * share affordance rather than copying a broken URL.
 */
export function encodeLegs(t: SharedTradeInput): string {
  if (!t.legs.length || t.legs.length > MAX_SHARE_LEGS) return "";
  const legs = t.legs
    .map(
      (l) =>
        `${l.side === "long" ? "b" : "s"}${l.type === "C" ? "c" : "p"}` +
        `${num(l.strike)}-${Math.round(l.qty)}-${num(l.premium)}`
    )
    .join("_");
  const param = [
    SHARE_VERSION,
    t.underlying.trim().toUpperCase(),
    num(t.spot),
    Math.round(t.daysToExpiry),
    legs,
  ].join("~");
  // Round-trip before handing it out: a link that will not decode is worse
  // than no link, and this is the cheapest possible place to find that out.
  return param.length <= MAX_SHARE_PARAM && decodeLegs(param) ? param : "";
}

/**
 * Decode + validate a `t=` parameter. Null for anything that is not a
 * well-formed, in-bounds trade — garbage, tampering, truncation, an unknown
 * version, or a leg count this builder does not make.
 */
export function decodeLegs(param: string | null | undefined): SharedTrade | null {
  if (!param || param.length > MAX_SHARE_PARAM) return null;
  const parts = param.split("~");
  if (parts.length !== 5) return null;
  const [v, underlying, spotRaw, daysRaw, legsRaw] = parts;
  if (v !== String(SHARE_VERSION)) return null;

  const legTokens = legsRaw.split("_");
  if (legTokens.length > MAX_SHARE_LEGS) return null;
  const legs: SharedLegInput[] = [];
  for (const tok of legTokens) {
    const m = LEG_RE.exec(tok);
    if (!m) return null;
    legs.push({
      side: m[1] === "b" ? "long" : "short",
      type: m[2] === "c" ? "C" : "P",
      strike: Number(m[3]),
      qty: Number(m[4]),
      premium: Number(m[5]),
    });
  }

  const parsed = SharedTradeSchema.safeParse({
    v: SHARE_VERSION,
    underlying,
    spot: Number(spotRaw),
    daysToExpiry: Number(daysRaw),
    legs,
  });
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    // Ids are ours, not the URL's — nothing from outside becomes a React key
    // or a position id.
    legs: parsed.data.legs.map((l, i) => ({ ...l, id: `shared-${i}` })),
  };
}

/** The link a reader copies. `${SITE_URL}/trade?t=…` */
export function shareUrl(t: SharedTradeInput, origin: string = SITE_URL): string {
  const param = encodeLegs(t);
  return param ? `${origin}/trade?t=${param}` : `${origin}/trade`;
}

/** The OG card for a shared trade. Same param, bounded the same way. */
export function ogImageUrl(param: string, origin: string = SITE_URL): string {
  return `${origin}/api/og/trade?t=${encodeURIComponent(param)}`;
}
