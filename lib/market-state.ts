// Yahoo's v8 chart meta carries NO `marketState` field — the old fallback
// `meta.regularMarketTime ? "REGULAR" : "CLOSED"` was therefore ALWAYS true
// (regularMarketTime is just the last trade stamp), so the ticker read
// "NYSE OPEN" at 3am on a Saturday. The meta does carry currentTradingPeriod
// windows, so derive the state from those instead.
export type MarketState = "PRE" | "REGULAR" | "POST" | "CLOSED";

type Period = { start?: number; end?: number };
export type MarketMeta = {
  marketState?: string;
  currentTradingPeriod?: { pre?: Period; regular?: Period; post?: Period };
  regularMarketTime?: number;
};

const RECENT_TRADE_SEC = 15 * 60;

export function deriveMarketState(meta: MarketMeta | undefined, nowMs: number = Date.now()): MarketState {
  // If a provider ever does hand us a real state, trust it.
  const raw = meta?.marketState;
  if (raw === "PRE" || raw === "REGULAR" || raw === "POST" || raw === "CLOSED") return raw;

  const now = Math.floor(nowMs / 1000);
  const p = meta?.currentTradingPeriod;
  const within = (w?: Period) =>
    !!w && typeof w.start === "number" && typeof w.end === "number" && now >= w.start && now < w.end;

  if (within(p?.regular)) return "REGULAR";
  if (within(p?.pre)) return "PRE";
  if (within(p?.post)) return "POST";
  // Windows were present and we're outside all of them → genuinely closed.
  if (typeof p?.regular?.start === "number") return "CLOSED";

  // No trading-period info at all: fall back to trade recency.
  const last = meta?.regularMarketTime;
  return typeof last === "number" && now - last < RECENT_TRADE_SEC ? "REGULAR" : "CLOSED";
}
