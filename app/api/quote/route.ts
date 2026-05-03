import { NextResponse } from "next/server";

// Free public Yahoo Finance chart endpoint. Returns OHLCV bars + meta.
// We proxy through our own route so the browser doesn't hit CORS issues.

const RANGE_INTERVAL: Record<string, { range: string; interval: string }> = {
  "1m": { range: "1d", interval: "1m" },
  "5m": { range: "5d", interval: "5m" },
  "15m": { range: "1mo", interval: "15m" },
  "1h": { range: "3mo", interval: "60m" },
  "4h": { range: "6mo", interval: "1h" }, // Yahoo doesn't expose 4h; use 1h with downsample
  D: { range: "5y", interval: "1d" },
  W: { range: "10y", interval: "1wk" },
  M: { range: "max", interval: "1mo" },
};

export const revalidate = 30; // cache for 30s

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const tf = searchParams.get("tf") || "D";
  const cfg = RANGE_INTERVAL[tf] ?? RANGE_INTERVAL.D;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false&events=div%2Csplits`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (lazybullpro/1.0)" },
      next: { revalidate: 30 },
    });
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    if (!result) throw new Error("no result");
    const ts: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const o: (number | null)[] = q.open || [];
    const h: (number | null)[] = q.high || [];
    const l: (number | null)[] = q.low || [];
    const c: (number | null)[] = q.close || [];
    const v: (number | null)[] = q.volume || [];
    const meta = result.meta || {};

    // build bars, dropping null gaps
    let bars: { i: number; t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (o[i] == null || c[i] == null) continue;
      bars.push({
        i: bars.length,
        t: ts[i] * 1000,
        o: o[i] as number,
        h: (h[i] ?? o[i]) as number,
        l: (l[i] ?? o[i]) as number,
        c: c[i] as number,
        v: v[i] ?? 0,
      });
    }

    // 4h downsample from 1h (group 4 bars)
    if (tf === "4h" && bars.length > 4) {
      const grouped: typeof bars = [];
      for (let i = 0; i < bars.length; i += 4) {
        const slice = bars.slice(i, i + 4);
        grouped.push({
          i: grouped.length,
          t: slice[0].t,
          o: slice[0].o,
          h: Math.max(...slice.map((b) => b.h)),
          l: Math.min(...slice.map((b) => b.l)),
          c: slice[slice.length - 1].c,
          v: slice.reduce((a, b) => a + b.v, 0),
        });
      }
      bars = grouped;
    }

    return NextResponse.json({
      ok: true,
      symbol,
      tf,
      bars,
      meta: {
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        instrumentType: meta.instrumentType,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        chartPreviousClose: meta.chartPreviousClose,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        regularMarketVolume: meta.regularMarketVolume,
        gmtoffset: meta.gmtoffset,
        marketState: meta.regularMarketTime ? "REGULAR" : "CLOSED",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
