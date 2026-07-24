// Finnhub — tertiary quotes-only provider. Its free tier gives real-time US
// stock quotes but dropped the candle endpoint, so getBars is unsupported
// (supportsIntraday() === false and getBars throws). It's per-symbol (no batch),
// so getQuotes fans out with small concurrency — fine because it's only reached
// when BOTH Alpaca and Twelve Data are down, and the orchestrator caches.

import {
  type BarsResult,
  type MarketDataProvider,
  type ProviderHealth,
  type Quote,
  isCrypto,
  num,
} from "./provider";
import { getHealth } from "./health";

const BASE = "https://finnhub.io/api/v1";
const KEY = process.env.FINNHUB_API_KEY || "";
const CONCURRENCY = 4;

async function quoteOne(symbol: string): Promise<Quote | null> {
  const r = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`finnhub ${r.status}`); // let 429/5xx trip the breaker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await r.json()) as any;
  const last = num(j.c);
  // c===0 with pc===0 means "unknown symbol" — a clean miss, not a failure.
  if (last == null || (last === 0 && num(j.pc) === 0)) return null;
  const prev = num(j.pc) ?? last;
  return {
    sym: symbol,
    last,
    chg: num(j.d) ?? last - prev,
    chgPct: num(j.dp) ?? (prev ? ((last - prev) / prev) * 100 : 0),
    marketTime: typeof j.t === "number" ? j.t : null,
  };
}

export const finnhub: MarketDataProvider = {
  name: () => "finnhub",
  supportsRealtime: () => true,
  supportsCrypto: () => false, // crypto uses exchange-prefixed symbols; leave to Alpaca/TD
  supportsIntraday: () => false,
  available: () => !!KEY,
  health: (): ProviderHealth => getHealth("finnhub"),

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const targets = symbols.filter((s) => !isCrypto(s)); // finnhub stock symbols only
    const out: Quote[] = [];
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= targets.length) return;
        const q = await quoteOne(targets[i]); // a thrown 429/5xx aborts the batch → breaker
        if (q) out.push(q);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    if (!out.length) throw new Error("finnhub: no quotes");
    return out;
  },

  async getQuote(symbol: string): Promise<Quote> {
    const q = await quoteOne(symbol);
    if (!q) throw new Error("finnhub: no quote");
    return q;
  },

  async getBars(): Promise<BarsResult> {
    // Free tier has no candle endpoint — declared via supportsIntraday()===false;
    // throwing keeps the contract total and lets the chain move on.
    throw new Error("finnhub: bars unsupported on free tier");
  },
};
