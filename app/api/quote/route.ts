import { NextResponse } from "next/server";
import { deriveMarketState } from "@/lib/market-state";

// OHLCV bars for /quant and the charts. Two upstreams, in order:
//   1. Twelve Data (keyed) — the real fix. Yahoo's public endpoint greylists
//      datacenter IPs, so on Vercel (and any throttled server) it returns a
//      flapping 429 and /quant shows OFFLINE forever. Twelve Data serves an
//      API-key holder from anywhere, so the live tape actually stays online.
//      Set TWELVE_DATA_API_KEY to enable (free tier: twelvedata.com).
//   2. Yahoo public chart — keyless fallback when no key is set or TD is down.
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

// Twelve Data equivalents. TD exposes 4h natively (no downsample needed).
const TD_INTERVAL: Record<string, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  D: "1day",
  W: "1week",
  M: "1month",
};
// Roughly match the Yahoo range depths so charts keep their history.
const TD_OUTPUTSIZE: Record<string, number> = {
  "1m": 390,
  "5m": 390,
  "15m": 450,
  "1h": 500,
  "4h": 500,
  D: 1300,
  W: 520,
  M: 360,
};

type Bar = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };

export const revalidate = 30; // cache for 30s

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const num = (x: any): number | undefined => {
  const n = parseFloat(String(x));
  return Number.isFinite(n) ? n : undefined;
};

async function fetchFromTwelveData(
  symbol: string,
  tf: string,
  cacheS: number,
  key: string
): Promise<{ bars: Bar[]; meta: Record<string, unknown> } | null> {
  const interval = TD_INTERVAL[tf] ?? "1day";
  const size = TD_OUTPUTSIZE[tf] ?? 500;
  const base = "https://api.twelvedata.com";
  const opts = { signal: AbortSignal.timeout(6000), next: { revalidate: cacheS } } as const;
  // order=ASC returns bars chronologically (oldest first) — no reversing.
  const tsUrl = `${base}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${size}&order=ASC&format=JSON&apikey=${key}`;
  const qUrl = `${base}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;

  const [tsSettled, qSettled] = await Promise.allSettled([fetch(tsUrl, opts), fetch(qUrl, opts)]);
  if (tsSettled.status !== "fulfilled" || !tsSettled.value.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts: any = await tsSettled.value.json();
  // TD errors come back as { status: "error", code, message } with HTTP 200,
  // so status must be checked explicitly before trusting `values`.
  if (ts?.status !== "ok" || !Array.isArray(ts.values) || ts.values.length < 2) return null;

  const bars: Bar[] = [];
  for (const v of ts.values) {
    const o = num(v.open);
    const c = num(v.close);
    if (o == null || c == null) continue;
    const h = num(v.high);
    const l = num(v.low);
    const vol = num(v.volume);
    bars.push({
      i: bars.length,
      t: new Date(String(v.datetime).replace(" ", "T")).getTime(),
      o,
      h: h ?? o,
      l: l ?? o,
      c,
      v: vol ?? 0,
    });
  }
  if (bars.length < 2) return null;

  // Best-effort live quote for spot + true market state; the bars stand on
  // their own if it fails.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = null;
  if (qSettled.status === "fulfilled" && qSettled.value.ok) {
    try {
      const qj = await qSettled.value.json();
      if (qj && !qj.code && qj.status !== "error") q = qj;
    } catch {
      /* quote is optional */
    }
  }
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const marketOpen = q ? q.is_market_open === true || q.is_market_open === "true" : undefined;

  const meta = {
    currency: q?.currency ?? ts.meta?.currency,
    exchangeName: q?.exchange ?? ts.meta?.exchange,
    instrumentType: q?.type ?? ts.meta?.type,
    regularMarketPrice: num(q?.close) ?? last.c,
    regularMarketTime: (typeof q?.timestamp === "number" ? q.timestamp : undefined) ?? Math.floor(last.t / 1000),
    previousClose: num(q?.previous_close) ?? prev.c,
    chartPreviousClose: prev.c,
    fiftyTwoWeekHigh: num(q?.fifty_two_week?.high),
    fiftyTwoWeekLow: num(q?.fifty_two_week?.low),
    regularMarketVolume: num(q?.volume) ?? last.v,
    gmtoffset: 0,
    // is_market_open is holiday-aware at the provider; deriveMarketState trusts
    // an explicit REGULAR/CLOSED. Without a quote, fall back to trade-recency.
    marketState:
      marketOpen === undefined
        ? deriveMarketState({ regularMarketTime: Math.floor(last.t / 1000) })
        : marketOpen
          ? "REGULAR"
          : "CLOSED",
  };
  return { bars, meta };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const tf = searchParams.get("tf") || "D";
  const cfg = RANGE_INTERVAL[tf] ?? RANGE_INTERVAL.D;
  // Daily/weekly/monthly bars barely move intraday — cache them 5 min so one
  // fetch serves everyone and the upstream sees ~10× fewer requests (fewer
  // rate-limit misses → fewer "OFFLINE" fallbacks). Intraday stays fresh at 30s.
  const cacheS = /^(D|W|M)$/.test(tf) ? 300 : 30;

  // ── Primary: Twelve Data (keyed, survives datacenter IPs) ──
  const tdKey = process.env.TWELVE_DATA_API_KEY;
  if (tdKey) {
    try {
      const td = await fetchFromTwelveData(symbol, tf, cacheS, tdKey);
      if (td && td.bars.length > 2) {
        return NextResponse.json({ ok: true, symbol, tf, source: "twelvedata", bars: td.bars, meta: td.meta });
      }
    } catch {
      /* fall through to Yahoo */
    }
  }

  // ── Fallback: Yahoo public chart (keyless, but greylists servers) ──
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false&events=div%2Csplits`;
  // A realistic browser UA + a query1→query2 failover cuts a few misses, but
  // once an IP is greylisted every host 429s — that's why TD is the real fix.
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
    let bars: Bar[] = [];
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
      source: "yahoo",
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
