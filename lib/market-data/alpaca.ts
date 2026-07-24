// Alpaca — the primary provider. Free "Basic" plan streams REAL-TIME data from
// IEX, served over an authenticated API, so (unlike Yahoo's scraped endpoint) it
// does NOT greylist datacenter IPs — the whole Vercel 429 problem disappears.
// Keys are SERVER-SIDE ONLY (never shipped to the browser).
//
// Paid upgrade with zero code change: set ALPACA_FEED=sip to get the full
// consolidated tape instead of IEX. Everything else is identical.
//
// Coverage note: Alpaca serves US stocks/ETFs + crypto, but NOT indices
// (^VIX, ^GSPC…). Those symbols throw here (a NON-qualifying "unsupported"
// error, so the breaker doesn't trip) and the orchestrator's chain fills them
// from Twelve Data / Yahoo. See ./index.

import {
  type Bar,
  type BarsResult,
  type MarketDataProvider,
  type ProviderHealth,
  type Quote,
  isCrypto,
  num,
} from "./provider";
import { getHealth } from "./health";

const DATA = "https://data.alpaca.markets";
const TRADING = "https://api.alpaca.markets";

const KEY = process.env.ALPACA_KEY_ID || "";
const SECRET = process.env.ALPACA_SECRET || "";
const FEED = process.env.ALPACA_FEED || "iex"; // iex (free) | sip (paid) — one env, no code change

const TF: Record<string, string> = {
  "1m": "1Min", "5m": "5Min", "15m": "15Min", "1h": "1Hour", "4h": "4Hour",
  D: "1Day", W: "1Week", M: "1Month",
};
const BAR_LIMIT: Record<string, number> = {
  "1m": 390, "5m": 390, "15m": 450, "1h": 500, "4h": 500, D: 1300, W: 520, M: 360,
};

function headers() {
  return { "APCA-API-KEY-ID": KEY, "APCA-API-SECRET-KEY": SECRET, Accept: "application/json" };
}
async function get(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) throw new Error(`alpaca ${r.status}`); // 429/5xx bubble up → breaker
  return (await r.json()) as Record<string, unknown>;
}

/** app symbol → Alpaca crypto pair (BTC → BTC/USD). */
const cryptoPair = (s: string) => (s.includes("/") ? s : `${s.replace(/USD$|USDT$/i, "")}/USD`);

const iso = (t: unknown) => (typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function barsFrom(raw: any[]): Bar[] {
  const bars: Bar[] = [];
  for (const b of raw || []) {
    const o = num(b.o), c = num(b.c);
    if (o == null || c == null) continue;
    const h = num(b.h), l = num(b.l), v = num(b.v);
    bars.push({ i: bars.length, t: new Date(b.t).getTime(), o, h: h ?? o, l: l ?? o, c, v: v ?? 0 });
  }
  return bars;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function metaFrom(bars: Bar[], snap: any, marketState?: string): BarsResult["meta"] {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  return {
    regularMarketPrice: num(snap?.latestTrade?.p) ?? last?.c,
    regularMarketTime: iso(snap?.latestTrade?.t) ?? (last ? Math.floor(last.t / 1000) : undefined),
    previousClose: num(snap?.prevDailyBar?.c) ?? prev?.c,
    chartPreviousClose: prev?.c,
    regularMarketVolume: num(snap?.dailyBar?.v) ?? last?.v,
    gmtoffset: 0,
    marketState,
  };
}

let clockCache: { state: string; at: number } | null = null;
/** US market open/closed from Alpaca's holiday-aware clock, memoised ~10s. */
async function marketState(): Promise<string | undefined> {
  if (clockCache && Date.now() - clockCache.at < 10_000) return clockCache.state;
  try {
    const c = await get(`${TRADING}/v2/clock`);
    const state = c.is_open ? "REGULAR" : "CLOSED";
    clockCache = { state, at: Date.now() };
    return state;
  } catch {
    return undefined; // deriveMarketState() falls back to trade-recency downstream
  }
}

export const alpaca: MarketDataProvider = {
  name: () => "alpaca",
  supportsRealtime: () => true,
  supportsCrypto: () => true,
  supportsIntraday: () => true,
  available: () => !!(KEY && SECRET),
  health: (): ProviderHealth => getHealth("alpaca"),

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const stocks = symbols.filter((s) => !isCrypto(s) && !s.startsWith("^"));
    const cryptos = symbols.filter(isCrypto);
    // Indices (^…) are unsupported — signal it so the chain fills them elsewhere.
    if (symbols.length && !stocks.length && !cryptos.length) throw new Error("alpaca: unsupported symbols");

    const out: Quote[] = [];
    const [state, stockSnap, cryptoSnap] = await Promise.all([
      stocks.length ? marketState() : Promise.resolve(undefined),
      stocks.length
        ? get(`${DATA}/v2/stocks/snapshots?symbols=${encodeURIComponent(stocks.join(","))}&feed=${FEED}`)
        : Promise.resolve({} as Record<string, unknown>),
      cryptos.length
        ? get(`${DATA}/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(cryptos.map(cryptoPair).join(","))}`)
        : Promise.resolve({} as Record<string, unknown>),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pushSnap = (sym: string, snap: any, st?: string) => {
      if (!snap) return;
      const last = num(snap.latestTrade?.p) ?? num(snap.dailyBar?.c);
      if (last == null) return;
      const prev = num(snap.prevDailyBar?.c) ?? last;
      const chg = last - prev;
      out.push({
        sym,
        last,
        chg,
        chgPct: prev ? (chg / prev) * 100 : 0,
        marketState: st,
        marketTime: iso(snap.latestTrade?.t) ?? null,
      });
    };
    for (const s of stocks) pushSnap(s, (stockSnap as Record<string, unknown>)[s], state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cSnaps = (cryptoSnap as any).snapshots ?? {};
    for (const s of cryptos) pushSnap(s, cSnaps[cryptoPair(s)], "REGULAR"); // crypto trades 24/7
    return out;
  },

  async getQuote(symbol: string): Promise<Quote> {
    const [q] = await this.getQuotes([symbol]);
    if (!q) throw new Error("alpaca: no quote");
    return q;
  },

  async getBars(symbol: string, tf: string, limit?: number): Promise<BarsResult> {
    if (symbol.startsWith("^")) throw new Error("alpaca: indices unsupported");
    const timeframe = TF[tf] ?? "1Day";
    const n = limit ?? BAR_LIMIT[tf] ?? 500;

    if (isCrypto(symbol)) {
      const pair = cryptoPair(symbol);
      const j = await get(
        `${DATA}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=${timeframe}&limit=${n}&sort=asc`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bars = barsFrom(((j as any).bars ?? {})[pair] ?? []);
      if (bars.length < 2) throw new Error("alpaca: no crypto bars");
      return { bars, meta: metaFrom(bars, null, "REGULAR") };
    }

    const j = await get(
      `${DATA}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${timeframe}&limit=${n}&feed=${FEED}&sort=asc&adjustment=all`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bars = barsFrom((j as any).bars ?? []);
    if (bars.length < 2) throw new Error("alpaca: no bars");
    // A cheap snapshot gives a live spot + prev close + market state for meta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let snap: any = null;
    let state: string | undefined;
    try {
      [snap, state] = await Promise.all([
        get(`${DATA}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbol)}&feed=${FEED}`).then(
          (s) => (s as Record<string, unknown>)[symbol]
        ),
        marketState(),
      ]);
    } catch {
      /* meta falls back to the bars themselves */
    }
    return { bars, meta: metaFrom(bars, snap, state) };
  },
};
