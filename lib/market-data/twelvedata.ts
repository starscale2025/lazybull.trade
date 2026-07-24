// Twelve Data — secondary. A keyed REST feed that serves datacenter IPs (so it
// also dodges the Yahoo greylist). Free tier is delayed, so it's marked
// non-realtime (Tier B). Crucially it DOES serve indices (VIX, SPX…), which
// Alpaca can't — so it backfills those in the chain. This is the code that used
// to live inline in /api/quote, lifted behind the provider interface.

import {
  type Bar,
  type BarsResult,
  type MarketDataProvider,
  type ProviderHealth,
  type Quote,
  num,
} from "./provider";
import { getHealth } from "./health";

const BASE = "https://api.twelvedata.com";
const KEY = process.env.TWELVE_DATA_API_KEY || "";

const INTERVAL: Record<string, string> = {
  "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h", "4h": "4h",
  D: "1day", W: "1week", M: "1month",
};
const OUTPUTSIZE: Record<string, number> = {
  "1m": 390, "5m": 390, "15m": 450, "1h": 500, "4h": 500, D: 1300, W: 520, M: 360,
};

/** app symbol → Twelve Data symbol. ^VIX→VIX, ^GSPC→SPX, BTC→BTC/USD. */
function tdSymbol(s: string): string {
  if (s === "^VIX") return "VIX";
  if (s === "^GSPC") return "SPX";
  if (s.startsWith("^")) return s.slice(1);
  if (/^(BTC|ETH|SOL|DOGE|LTC)$/i.test(s)) return `${s}/USD`;
  return s;
}

async function getJSON(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) throw new Error(`twelvedata ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

export const twelvedata: MarketDataProvider = {
  name: () => "twelvedata",
  supportsRealtime: () => false, // free tier is delayed
  supportsCrypto: () => true,
  supportsIntraday: () => true,
  available: () => !!KEY,
  health: (): ProviderHealth => getHealth("twelvedata"),

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const mapped = symbols.map(tdSymbol);
    const back = new Map(mapped.map((m, i) => [m, symbols[i]])); // td symbol → app symbol
    const j = await getJSON(`${BASE}/quote?symbol=${encodeURIComponent(mapped.join(","))}&apikey=${KEY}`);
    // TD returns a single object for one symbol, or a map keyed by symbol.
    const rows = symbols.length === 1 ? { [mapped[0]]: j } : (j as Record<string, unknown>);
    const out: Quote[] = [];
    for (const [tdSym, rawUnknown] of Object.entries(rows)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = rawUnknown as any;
      if (!raw || raw.status === "error" || raw.code) continue;
      const last = num(raw.close);
      if (last == null) continue;
      const prev = num(raw.previous_close) ?? last;
      out.push({
        sym: back.get(tdSym) ?? tdSym,
        name: raw.name,
        last,
        chg: num(raw.change) ?? last - prev,
        chgPct: num(raw.percent_change) ?? (prev ? ((last - prev) / prev) * 100 : 0),
        currency: raw.currency,
        exch: raw.exchange,
        marketState:
          raw.is_market_open === true || raw.is_market_open === "true" ? "REGULAR" : "CLOSED",
        marketTime: typeof raw.timestamp === "number" ? raw.timestamp : null,
      });
    }
    if (!out.length) throw new Error("twelvedata: no quotes");
    return out;
  },

  async getQuote(symbol: string): Promise<Quote> {
    const [q] = await this.getQuotes([symbol]);
    if (!q) throw new Error("twelvedata: no quote");
    return q;
  },

  async getBars(symbol: string, tf: string, limit?: number): Promise<BarsResult> {
    const sym = tdSymbol(symbol);
    const interval = INTERVAL[tf] ?? "1day";
    const size = limit ?? OUTPUTSIZE[tf] ?? 500;
    const [tsRes, qRes] = await Promise.allSettled([
      getJSON(
        `${BASE}/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=${size}&order=ASC&format=JSON&apikey=${KEY}`
      ),
      getJSON(`${BASE}/quote?symbol=${encodeURIComponent(sym)}&apikey=${KEY}`),
    ]);
    if (tsRes.status !== "fulfilled") throw tsRes.reason;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = tsRes.value as any;
    if (ts?.status !== "ok" || !Array.isArray(ts.values) || ts.values.length < 2) {
      throw new Error("twelvedata: no bars");
    }
    const bars: Bar[] = [];
    for (const v of ts.values) {
      const o = num(v.open), c = num(v.close);
      if (o == null || c == null) continue;
      const h = num(v.high), l = num(v.low), vol = num(v.volume);
      bars.push({
        i: bars.length,
        t: new Date(String(v.datetime).replace(" ", "T")).getTime(),
        o, h: h ?? o, l: l ?? o, c, v: vol ?? 0,
      });
    }
    if (bars.length < 2) throw new Error("twelvedata: no bars");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = qRes.status === "fulfilled" ? (qRes.value as any) : null;
    const okQ = q && !q.code && q.status !== "error" ? q : null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const marketOpen = okQ ? okQ.is_market_open === true || okQ.is_market_open === "true" : undefined;
    return {
      bars,
      meta: {
        currency: okQ?.currency ?? ts.meta?.currency,
        exchangeName: okQ?.exchange ?? ts.meta?.exchange,
        instrumentType: okQ?.type ?? ts.meta?.type,
        regularMarketPrice: num(okQ?.close) ?? last.c,
        regularMarketTime:
          (typeof okQ?.timestamp === "number" ? okQ.timestamp : undefined) ?? Math.floor(last.t / 1000),
        previousClose: num(okQ?.previous_close) ?? prev.c,
        chartPreviousClose: prev.c,
        fiftyTwoWeekHigh: num(okQ?.fifty_two_week?.high),
        fiftyTwoWeekLow: num(okQ?.fifty_two_week?.low),
        regularMarketVolume: num(okQ?.volume) ?? last.v,
        gmtoffset: 0,
        marketState: marketOpen === undefined ? undefined : marketOpen ? "REGULAR" : "CLOSED",
      },
    };
  },
};
