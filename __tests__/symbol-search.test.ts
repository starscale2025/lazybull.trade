import { afterEach, describe, expect, it, vi } from "vitest";
import { SYMBOL_UNIVERSE, searchSymbols, searchWithTyped } from "@/lib/market-data/symbols";
import { typedTicker } from "@/lib/market-data/ticker";

// The Pro charts symbol pickers (2026-11-20). /api/symbol-search used to ask
// Yahoo unconditionally, in production too, though Yahoo is the unlicensed
// scrape the quote chain keeps off there. It now follows the same switch and
// otherwise searches the built-in list, where any typed ticker stays reachable.

describe("the built-in symbol list", () => {
  it("has each ticker once, each one a ticker the pickers can type", () => {
    const syms = SYMBOL_UNIVERSE.map((s) => s.sym);
    expect(new Set(syms).size).toBe(syms.length);
    for (const s of SYMBOL_UNIVERSE) {
      expect(typedTicker(s.sym)?.sym, s.sym).toBe(s.sym);
      expect(s.name.trim().length, s.sym).toBeGreaterThan(0);
    }
  });

  it("finds by ticker and by name, best match first", () => {
    expect(searchSymbols("aapl")[0].sym).toBe("AAPL");
    expect(searchSymbols("nvidia")[0].sym).toBe("NVDA");
    expect(searchSymbols("btc")[0].sym).toBe("BTC-USD");
    expect(searchSymbols("bank of america")[0].sym).toBe("BAC");
    expect(searchSymbols("nifty").map((s) => s.sym)).toContain("^NSEI");
    expect(searchSymbols("reliance")[0].sym).toBe("RELIANCE.NS");
    expect(searchSymbols("")).toEqual([]);
    expect(searchSymbols("a").length).toBeLessThanOrEqual(12);
  });

  it("offers the query as a ticker only when nothing matches it exactly", () => {
    const unknown = searchWithTyped("zzzz");
    expect(unknown.at(-1)).toEqual({ sym: "ZZZZ", name: "ZZZZ", exch: "", typed: true });
    expect(searchWithTyped("aapl").some((s) => s.typed)).toBe(false);
    expect(searchWithTyped("apple inc").some((s) => s.typed)).toBe(false); // a phrase is not a ticker
  });
});

describe("typedTicker", () => {
  it("accepts ticker shapes and refuses phrases", () => {
    expect(typedTicker(" brk.b ")?.sym).toBe("BRK.B");
    expect(typedTicker("btc-usd")?.sym).toBe("BTC-USD");
    expect(typedTicker("^nsei")?.sym).toBe("^NSEI");
    expect(typedTicker("tcs.ns")?.sym).toBe("TCS.NS");
    expect(typedTicker("apple inc")).toBeNull();
    expect(typedTicker("")).toBeNull();
    expect(typedTicker("x".repeat(16))).toBeNull();
  });
});

describe("/api/symbol-search", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function search(q: string) {
    vi.resetModules();
    const { GET } = await import("@/app/api/symbol-search/route");
    const res = await GET(new Request(`http://localhost/api/symbol-search?q=${encodeURIComponent(q)}`));
    return res.json();
  }

  it("never asks Yahoo in production, and still finds names", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKET_DATA_ALLOW_YAHOO", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const j = await search("nvidia");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(j.ok).toBe(true);
    expect(j.source).toBe("list");
    expect(j.items[0].sym).toBe("NVDA");
  });

  it("tags Indian listings as delayed, where a source carries them", async () => {
    // Yahoo allowed, and failing: the list answers, and the list is whole.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKET_DATA_ALLOW_YAHOO", "1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too Many Requests", { status: 429 })));
    const j = await search("infosys");
    expect(j.items[0]).toMatchObject({ sym: "INFY.NS", delayed: true });
  });

  it("offers nothing the deployment cannot price: no indices or Indian names on the US feed alone", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKET_DATA_ALLOW_YAHOO", "");
    vi.stubEnv("TWELVE_DATA_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    const syms = async (q: string) => ((await search(q)).items as { sym: string }[]).map((i) => i.sym);
    expect(await syms("infosys")).not.toContain("INFY.NS");
    expect(await syms("nifty")).toEqual([]); // every match is an index, and "NIFTY" typed is one too
    expect(await syms("^GSPC")).toEqual([]);
    expect(await syms("s&p")).not.toContain("^GSPC");
    // what it does carry is all still there
    expect((await syms("apple"))[0]).toBe("AAPL");
    expect(await syms("bitcoin")).toContain("BTC-USD");
    expect(await syms("ROKU")).toContain("ROKU"); // a typed US ticker stays reachable
  });

  it("falls back to the list when Yahoo is allowed but fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MARKET_DATA_ALLOW_YAHOO", "1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too Many Requests", { status: 429 })));
    const j = await search("tesla");
    expect(j.ok).toBe(true);
    expect(j.source).toBe("list");
    expect(j.items[0].sym).toBe("TSLA");
  });
});
