// A ticker typed straight into a symbol picker. Kept apart from the symbol
// list (lib/market-data/symbols.ts) so the pickers can use it without
// shipping that list to the browser.

export type TypedTicker = { sym: string; name: string; exch: string };

/** AAPL, BRK.B, BTC-USD, ^NSEI, RELIANCE.NS: one token, 1-15 characters. */
const TICKER = /^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$/;

/** The query as a ticker to open as-is, or null if it can't be one. */
export function typedTicker(query: string): TypedTicker | null {
  const sym = query.trim().toUpperCase();
  return TICKER.test(sym) ? { sym, name: sym, exch: "" } : null;
}
