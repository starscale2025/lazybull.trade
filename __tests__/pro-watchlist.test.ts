// The Pro terminal's starting watchlist, and the swap of the list it replaced.

import { describe, expect, it } from "vitest";
import { DEFAULT_WATCHLIST, migrateWatchlist } from "@/lib/pro/watchlist";
import { namedNoFeed } from "@/lib/pro/no-feed";
import { SYMBOL_UNIVERSE } from "@/lib/market-data/symbols";

const OLD = ["^NSEI", "^NSEBANK", "^GSPC", "^IXIC", "AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "META", "GOOGL", "BTC-USD", "ETH-USD"];

describe("the default watchlist", () => {
  it("opens on symbols the site can price: no index, no Indian listing", () => {
    expect(DEFAULT_WATCHLIST.length).toBeGreaterThan(8);
    for (const s of DEFAULT_WATCHLIST) expect(namedNoFeed(s), s).toBe(false);
  });

  it("leads with the two funds that stand in for the US indices", () => {
    expect(DEFAULT_WATCHLIST.slice(0, 2)).toEqual(["SPY", "QQQ"]);
  });

  it("holds each symbol once, and each is on the site's list", () => {
    expect(new Set(DEFAULT_WATCHLIST).size).toBe(DEFAULT_WATCHLIST.length);
    const listed = new Set(SYMBOL_UNIVERSE.map((e) => e.sym));
    for (const s of DEFAULT_WATCHLIST) expect(listed.has(s), s).toBe(true);
  });
});

describe("a stored or synced list", () => {
  it("is swapped for the new default when it is the old one, untouched", () => {
    expect(migrateWatchlist([...OLD])).toEqual([...DEFAULT_WATCHLIST]);
  });

  it("comes back as a fresh array, so the caller can tell a swap happened", () => {
    const stored = [...OLD];
    expect(migrateWatchlist(stored)).not.toBe(stored);
  });

  it("is left alone, the same array, when a person changed it in any way", () => {
    const cases: string[][] = [
      [...OLD, "ROKU"], // added one
      OLD.slice(1), // removed one
      OLD.filter((s) => !s.startsWith("^")), // already cleared the indices themselves
      [OLD[1], OLD[0], ...OLD.slice(2)], // reordered
      ["^GSPC"], // an index somebody chose
      [],
      [...DEFAULT_WATCHLIST],
    ];
    for (const list of cases) expect(migrateWatchlist(list), list.join(",")).toBe(list);
  });
});
