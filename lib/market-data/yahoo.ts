// Yahoo — last-ditch, keyless. It greylists datacenter IPs (the whole reason for
// this layer), so it sits at the BOTTOM of the chain: only tried when every
// keyed provider is down, as one last shot at real data before falling to
// cache. It still works from home IPs and occasionally slips through on Vercel.
// This is the chart-endpoint code that used to live inline in the two routes.

import {
  type Bar,
  type BarsResult,
  type MarketDataProvider,
  type ProviderHealth,
  type Quote,
  isCrypto,
} from "./provider";
import { getHealth } from "./health";
import { deriveMarketState } from "@/lib/market-state";

const RANGE_INTERVAL: Record<string, { range: string; interval: string }> = {
  "1m": { range: "1d", interval: "1m" },
  "5m": { range: "5d", interval: "5m" },
  "15m": { range: "1mo", interval: "15m" },
  "1h": { range: "3mo", interval: "60m" },
  "4h": { range: "6mo", interval: "1h" },
  D: { range: "5y", interval: "1d" },
  W: { range: "10y", interval: "1wk" },
  M: { range: "max", interval: "1mo" },
};
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

async function chart(symbol: string, range: string, interval: string): Promise<Record<string, unknown>> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  let lastErr = "yahoo unreachable";
  for (const host of HOSTS) {
    try {
      const r = await fetch(host + path, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      if (!r.ok) {
        lastErr = `yahoo ${r.status}`;
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = (await r.json()) as any;
      const result = j?.chart?.result?.[0];
      if (result) return result;
      lastErr = "yahoo: no result";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

export const yahoo: MarketDataProvider = {
  name: () => "yahoo",
  supportsRealtime: () => false,
  supportsCrypto: () => false,
  supportsIntraday: () => true,
  available: () => true, // keyless — always a candidate, just last
  health: (): ProviderHealth => getHealth("yahoo"),

  async getBars(symbol: string, tf: string): Promise<BarsResult> {
    if (isCrypto(symbol)) throw new Error("yahoo: crypto skipped");
    const cfg = RANGE_INTERVAL[tf] ?? RANGE_INTERVAL.D;
    const result = await chart(symbol, cfg.range, cfg.interval);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    const ts: number[] = r.timestamp || [];
    const q = r.indicators?.quote?.[0] || {};
    const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];
    let bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (o[i] == null || c[i] == null) continue;
      bars.push({ i: bars.length, t: ts[i] * 1000, o: o[i], h: h[i] ?? o[i], l: l[i] ?? o[i], c: c[i], v: v[i] ?? 0 });
    }
    if (tf === "4h" && bars.length > 4) {
      const grouped: Bar[] = [];
      for (let i = 0; i < bars.length; i += 4) {
        const s = bars.slice(i, i + 4);
        grouped.push({
          i: grouped.length, t: s[0].t, o: s[0].o,
          h: Math.max(...s.map((b) => b.h)), l: Math.min(...s.map((b) => b.l)),
          c: s[s.length - 1].c, v: s.reduce((a, b) => a + b.v, 0),
        });
      }
      bars = grouped;
    }
    if (bars.length < 2) throw new Error("yahoo: no bars");
    const meta = r.meta || {};
    return {
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
    };
  },

  async getQuote(symbol: string): Promise<Quote> {
    const result = await chart(symbol, "2d", "1d");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    const meta = r.meta || {};
    const last = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    // Prev close from the daily bars (not chartPreviousClose, which is the close
    // before the requested range) — the newest bar from an earlier exchange-day.
    const ts: number[] = r.timestamp || [];
    const closes = r.indicators?.quote?.[0]?.close || [];
    const off = meta.gmtoffset ?? 0;
    const dayOf = (sec: number) => Math.floor((sec + off) / 86400);
    const curDay = dayOf(meta.regularMarketTime ?? ts[ts.length - 1] ?? 0);
    let prev: number | undefined;
    for (let i = ts.length - 1; i >= 0; i--) {
      if (closes[i] != null && dayOf(ts[i]) < curDay) { prev = closes[i]; break; }
    }
    const prevClose = prev ?? meta.previousClose ?? meta.chartPreviousClose ?? last;
    const chg = last - prevClose;
    return {
      sym: symbol,
      name: meta.longName || meta.shortName || symbol,
      last,
      chg,
      chgPct: prevClose ? (chg / prevClose) * 100 : 0,
      currency: meta.currency,
      exch: meta.fullExchangeName || meta.exchangeName,
      marketState: deriveMarketState(meta),
      marketTime: meta.regularMarketTime ?? null,
    };
  },

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const CONCURRENCY = 6;
    const results: (Quote | null)[] = new Array(symbols.length).fill(null);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, async () => {
        for (;;) {
          const i = cursor++;
          if (i >= symbols.length) return;
          try {
            results[i] = await this.getQuote(symbols[i]);
          } catch {
            results[i] = null; // a single-symbol miss shouldn't sink the batch
          }
        }
      })
    );
    const out = results.filter((q): q is Quote => q != null);
    if (!out.length) throw new Error("yahoo: no quotes");
    return out;
  },
};
