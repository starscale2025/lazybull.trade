import { NextResponse } from "next/server";
import { deriveMarketState } from "@/lib/market-state";

// Yahoo's v7/finance/quote endpoint now requires a crumb cookie. Use the
// public /v8/finance/chart endpoint per symbol in parallel — it returns the
// `meta.regularMarketPrice` and previous close, which is enough for a
// watchlist row.

export const revalidate = 30;

async function fetchOne(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (lazybullpro/1.0)" },
      signal: AbortSignal.timeout(6000), // a blackholed upstream must never wedge the server
      next: { revalidate: 30 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta || {};
    const last = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? last;
    const chg = last - prev;
    const chgPct = prev ? (chg / prev) * 100 : 0;
    return {
      sym: symbol,
      name: meta.longName || meta.shortName || symbol,
      last,
      chg,
      chgPct,
      currency: meta.currency,
      exch: meta.fullExchangeName || meta.exchangeName,
      marketState: deriveMarketState(meta),
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // One unauthenticated GET used to fan out into one upstream Yahoo fetch per
  // comma-separated entry, uncapped and un-deduplicated — ~1300 concurrent
  // outbound requests within Next's URL limit. That's both a rate-limit/ban
  // risk against the upstream and a cheap amplification primitive against us.
  const MAX_SYMBOLS = 50;
  const CONCURRENCY = 6;
  const symbols = [
    ...new Set(
      (searchParams.get("symbols") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, MAX_SYMBOLS);
  if (!symbols.length) return NextResponse.json({ ok: true, quotes: [] });

  // Small worker pool rather than a bare Promise.all over everything.
  const results: (Awaited<ReturnType<typeof fetchOne>>)[] = new Array(symbols.length).fill(null);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= symbols.length) return;
        results[i] = await fetchOne(symbols[i]);
      }
    })
  );
  const quotes = results.filter(Boolean);
  return NextResponse.json({ ok: true, quotes });
}
