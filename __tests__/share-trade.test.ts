// The share deep link, pinned.
//
// Two jobs. (1) The loop has to work: what one person copies is exactly what
// the next person's builder rebuilds — the memo's growth section named "No
// shareable 'copy this trade' card / deep link" as the one near-zero-cost
// channel the product did not have, and a codec that loses a leg is worse than
// no link. (2) The parameter is attacker-controlled and reaches an image
// renderer and a paper-position writer, so every malformed shape has to come
// back null rather than half a trade.

import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_LEGS,
  MAX_SHARE_PARAM,
  SHARE_VERSION,
  decodeLegs,
  encodeLegs,
  ogImageUrl,
  shareUrl,
  type SharedTradeInput,
} from "@/lib/share-trade";

const spread: SharedTradeInput = {
  underlying: "AMZN",
  spot: 226.45,
  daysToExpiry: 35,
  legs: [
    { type: "C", side: "long", strike: 230, qty: 1, premium: 5.2 },
    { type: "C", side: "short", strike: 240, qty: 1, premium: 2.1 },
  ],
};

const condor: SharedTradeInput = {
  underlying: "NVDA",
  spot: 138.9,
  daysToExpiry: 45,
  legs: [
    { type: "P", side: "long", strike: 120, qty: 2, premium: 1.35 },
    { type: "P", side: "short", strike: 130, qty: 2, premium: 3.4 },
    { type: "C", side: "short", strike: 150, qty: 2, premium: 3.05 },
    { type: "C", side: "long", strike: 160, qty: 2, premium: 1.15 },
  ],
};

describe("round trip", () => {
  it("rebuilds a two-leg spread exactly", () => {
    const t = decodeLegs(encodeLegs(spread));
    expect(t).not.toBeNull();
    expect(t!.underlying).toBe("AMZN");
    expect(t!.spot).toBe(226.45);
    expect(t!.daysToExpiry).toBe(35);
    expect(t!.legs.map(({ id: _id, ...l }) => l)).toEqual(spread.legs);
  });

  it("rebuilds a four-leg iron condor exactly", () => {
    const t = decodeLegs(encodeLegs(condor));
    expect(t!.legs.map(({ id: _id, ...l }) => l)).toEqual(condor.legs);
    expect(t!.legs).toHaveLength(4);
  });

  it("gives the legs OUR ids — nothing from the URL becomes a key or a position id", () => {
    const t = decodeLegs(encodeLegs(condor))!;
    expect(t.legs.map((l) => l.id)).toEqual(["shared-0", "shared-1", "shared-2", "shared-3"]);
  });

  it("normalises the ticker to upper case", () => {
    const t = decodeLegs(encodeLegs({ ...spread, underlying: "amzn" }))!;
    expect(t.underlying).toBe("AMZN");
  });

  it("carries index and foreign tickers", () => {
    for (const sym of ["^NSEI", "RELIANCE.NS", "BRK-B", "SPY"]) {
      expect(decodeLegs(encodeLegs({ ...spread, underlying: sym }))!.underlying).toBe(sym);
    }
  });

  it("rounds to two decimals rather than shipping float noise", () => {
    const t = decodeLegs(encodeLegs({ ...spread, spot: 226.4499999, legs: [{ ...spread.legs[0], premium: 5.199999 }] }))!;
    expect(t.spot).toBe(226.45);
    expect(t.legs[0].premium).toBe(5.2);
  });
});

describe("length bound", () => {
  it("keeps a four-leg trade well under 200 characters", () => {
    const param = encodeLegs(condor);
    expect(param.length).toBeLessThan(200);
    expect(param.length).toBeLessThanOrEqual(MAX_SHARE_PARAM);
  });

  it("is URL-safe end to end: nothing gets percent-encoded", () => {
    const param = encodeLegs(condor);
    expect(encodeURIComponent(param)).toBe(param);
    expect(param.startsWith(`${SHARE_VERSION}~`)).toBe(true);
  });

  it("refuses anything longer than the cap without parsing it", () => {
    expect(decodeLegs(`${encodeLegs(spread)}${"0".repeat(MAX_SHARE_PARAM)}`)).toBeNull();
  });

  it("returns an empty string rather than a broken link when it cannot encode", () => {
    expect(encodeLegs({ ...spread, legs: [] })).toBe("");
    expect(encodeLegs({ ...spread, legs: Array(MAX_SHARE_LEGS + 1).fill(spread.legs[0]) })).toBe("");
    // Out-of-bounds values fail the round-trip check inside encodeLegs.
    expect(encodeLegs({ ...spread, spot: 0 })).toBe("");
    expect(encodeLegs({ ...spread, legs: [{ ...spread.legs[0], strike: -5 }] })).toBe("");
  });
});

describe("never trust the URL", () => {
  it("rejects nothing, junk and prose", () => {
    for (const bad of [null, undefined, "", "hello", "1", "~~~~", "{}", "[object Object]"]) {
      expect(decodeLegs(bad)).toBeNull();
    }
  });

  it("rejects a wrong or missing version", () => {
    expect(decodeLegs("2~AMZN~226.45~35~bc230-1-5.2")).toBeNull();
    expect(decodeLegs("~AMZN~226.45~35~bc230-1-5.2")).toBeNull();
  });

  it("rejects the wrong number of fields", () => {
    expect(decodeLegs("1~AMZN~226.45~bc230-1-5.2")).toBeNull();
    expect(decodeLegs("1~AMZN~226.45~35~bc230-1-5.2~extra")).toBeNull();
  });

  it("rejects a tampered leg token", () => {
    for (const leg of [
      "xc230-1-5.2", // unknown side
      "bx230-1-5.2", // unknown type
      "bc-1-5.2", // no strike
      "bc230-1", // no premium
      "bc230-1-5.2-9", // a fourth number
      "bc230.123-1-5.2", // three decimals
      "bcNaN-1-5.2",
      "bcInfinity-1-5.2",
      "bc1e9-1-5.2", // exponent notation
      "bc-230-1-5.2", // negative strike
    ]) {
      expect(decodeLegs(`1~AMZN~226.45~35~${leg}`)).toBeNull();
    }
  });

  it("rejects out-of-range numbers", () => {
    expect(decodeLegs("1~AMZN~226.45~35~bc0-1-5.2")).toBeNull(); // strike 0
    expect(decodeLegs("1~AMZN~226.45~35~bc230-0-5.2")).toBeNull(); // qty 0
    expect(decodeLegs("1~AMZN~226.45~35~bc230-999-5.2")).toBeNull(); // qty > 100
    expect(decodeLegs("1~AMZN~226.45~9999~bc230-1-5.2")).toBeNull(); // 27 years out
    expect(decodeLegs("1~AMZN~0~35~bc230-1-5.2")).toBeNull(); // spot 0
    expect(decodeLegs("1~AMZN~99999999~35~bc230-1-5.2")).toBeNull(); // spot over cap
  });

  it("rejects more legs than this builder makes", () => {
    const legs = Array(MAX_SHARE_LEGS + 1).fill("bc230-1-5.2").join("_");
    expect(decodeLegs(`1~AMZN~226.45~35~${legs}`)).toBeNull();
  });

  it("rejects an underlying that is not a ticker", () => {
    for (const sym of ["<script>", "amzn", "A B", "TOOLONGSYMBOL1", "", "../../etc"]) {
      expect(decodeLegs(`1~${sym}~226.45~35~bc230-1-5.2`)).toBeNull();
    }
  });

  it("never throws, whatever it is handed", () => {
    for (const bad of ["1~".repeat(80), "%%%", "1~AMZN~226.45~35~" + "_".repeat(30)]) {
      expect(() => decodeLegs(bad)).not.toThrow();
      expect(decodeLegs(bad)).toBeNull();
    }
  });
});

describe("the URLs it builds", () => {
  it("points at /trade?t= on the canonical origin", () => {
    const url = shareUrl(spread, "https://example.test");
    expect(url).toBe(`https://example.test/trade?t=${encodeLegs(spread)}`);
    expect(decodeLegs(new URL(url).searchParams.get("t"))).not.toBeNull();
  });

  it("degrades to a plain /trade link rather than a broken one", () => {
    expect(shareUrl({ ...spread, legs: [] }, "https://example.test")).toBe("https://example.test/trade");
  });

  it("points the card at the OG route with the same param", () => {
    const param = encodeLegs(spread);
    expect(ogImageUrl(param, "https://example.test")).toBe(
      `https://example.test/api/og/trade?t=${param}`
    );
  });
});
