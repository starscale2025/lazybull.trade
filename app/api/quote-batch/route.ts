import { NextResponse } from "next/server";

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
      marketState: meta.marketState || (meta.regularMarketTime ? "REGULAR" : "CLOSED"),
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!symbols.length) return NextResponse.json({ ok: true, quotes: [] });

  const results = await Promise.all(symbols.map((s) => fetchOne(s)));
  const quotes = results.filter(Boolean);
  return NextResponse.json({ ok: true, quotes });
}
