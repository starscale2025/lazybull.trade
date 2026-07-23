import { NextResponse } from "next/server";
import { deriveMarketState } from "@/lib/market-state";

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
  // Daily/weekly/monthly bars barely move intraday — cache them 5 min so one
  // fetch serves everyone and Yahoo sees ~10× fewer requests (fewer 429s →
  // fewer "OFFLINE" fallbacks). Intraday stays fresh at 30s.
  const cacheS = /^(D|W|M)$/.test(tf) ? 300 : 30;

  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false&events=div%2Csplits`;
  // Yahoo throttles/blocks datacenter IPs (Vercel), which surfaces as "OFFLINE"
  // on /quant even though the same fetch works from a home IP. A realistic
  // browser UA + a query1→query2 failover cuts those misses.
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let j: any = null;
    let lastErr = "yahoo unreachable";
    for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
      try {
        const r = await fetch(host + path, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(6000), // a blackholed upstream must never wedge the server
          next: { revalidate: cacheS },
        });
        if (!r.ok) {
          lastErr = `yahoo ${r.status}`;
          continue;
        }
        j = await r.json();
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    if (!j) throw new Error(lastErr);
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
        regularMarketTime: meta.regularMarketTime,
        previousClose: meta.previousClose,
        chartPreviousClose: meta.chartPreviousClose,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        regularMarketVolume: meta.regularMarketVolume,
        gmtoffset: meta.gmtoffset,
        marketState: deriveMarketState(meta),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
