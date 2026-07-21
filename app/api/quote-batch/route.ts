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
    // Previous close must come from the daily bars, NOT meta.chartPreviousClose:
    // that field is the close before the requested RANGE starts (Friday on a 2d
    // request made on Tuesday), which overstated every day-change by days of
    // drift — the watchlist said −2.31% while Google said −0.21%. The bar for
    // the session `regularMarketPrice` belongs to is identified by exchange-day
    // (gmtoffset); the newest bar from an earlier day is the true prev close.
    const ts: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const off = meta.gmtoffset ?? 0;
    const dayOf = (sec: number) => Math.floor((sec + off) / 86400);
    const curDay = dayOf(meta.regularMarketTime ?? ts[ts.length - 1] ?? 0);
    let prev: number | undefined;
    for (let i = ts.length - 1; i >= 0; i--) {
      const c = closes[i];
      if (c != null && dayOf(ts[i]) < curDay) { prev = c; break; }
    }
    const prevClose: number = prev ?? meta.previousClose ?? meta.chartPreviousClose ?? last;
    const chg = last - prevClose;
    const chgPct = prevClose ? (chg / prevClose) * 100 : 0;
    return {
      sym: symbol,
      name: meta.longName || meta.shortName || symbol,
      last,
      chg,
      chgPct,
      currency: meta.currency,
      exch: meta.fullExchangeName || meta.exchangeName,
      marketState: deriveMarketState(meta),
      // Upstream snapshot time — lets the client order this quote against the
      // bars feed (both are 30s-cached separately, so either can be staler).
      marketTime: meta.regularMarketTime ?? null,
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
