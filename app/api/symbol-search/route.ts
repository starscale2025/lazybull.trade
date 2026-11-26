import { NextResponse } from "next/server";
import { isIndianSecurity } from "@/lib/region";
import { yahoo } from "@/lib/market-data/yahoo";
import { searchWithTyped } from "@/lib/market-data/symbols";
import { priceable } from "@/lib/market-data/coverage";

// Indian results stay in the list — the beginner funnel IS India — but each one
// is tagged `delayed: true` so the picker can say "31 d lag" before the user
// commits to a symbol whose prices will never be live here (lib/region.ts).
//
// Yahoo's search is the same unlicensed scrape as its quotes, so it follows the
// same switch (yahoo.available(): on in development, off in production unless
// MARKET_DATA_ALLOW_YAHOO=1). Otherwise, and whenever Yahoo fails, the pickers
// search the built-in list (lib/market-data/symbols.ts) and can open any typed
// ticker. `source` tells the picker which it got, so it can say so.

export const revalidate = 300;

const tagDelayed = <T extends { sym: string }>(it: T) => (isIndianSecurity(it.sym) ? { ...it, delayed: true } : it);

/** The built-in list's matches, held to what this deployment has a source for
    (lib/market-data/coverage.ts). With only the US feed configured, an index or
    an Indian name is a row that can never be priced: offering it in a picker
    sends the visitor to an empty chart. With a source that carries them, they
    are all back, the Indian ones tagged as before. */
function fromList(q: string) {
  const items = searchWithTyped(q, 24).filter((it) => priceable(it.sym)).slice(0, 13);
  return NextResponse.json({ ok: true, source: "list", items: items.map(tagDelayed) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: true, source: yahoo.available() ? "yahoo" : "list", items: [] });
  if (!yahoo.available()) return fromList(q);

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (lazybullpro/1.0)" },
      signal: AbortSignal.timeout(6000), // a blackholed upstream must never wedge the server
      next: { revalidate: 300 },
    });
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const j = await r.json();
    const items = (j.quotes || [])
      .filter((it: { symbol?: string }) => it.symbol)
      .map((it: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string; typeDisp?: string }) =>
        tagDelayed({
          sym: it.symbol,
          name: it.shortname || it.longname || it.symbol,
          exch: it.exchange || "",
          type: it.typeDisp || it.quoteType || "",
        }),
      );
    return NextResponse.json({ ok: true, source: "yahoo", items });
  } catch {
    // A 429 or an outage: the list still answers, so the picker never goes blank.
    return fromList(q);
  }
}
