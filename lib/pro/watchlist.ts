// The Pro terminal's starting watchlist, and the one-time swap of the list it
// replaced.

/** What a new visitor's watchlist holds: the two funds that stand in for the
    S&P 500 and the Nasdaq-100, seven stocks and two coins. Every one of them
    has a price on this site. */
export const DEFAULT_WATCHLIST: readonly string[] = [
  "SPY", "QQQ",
  "AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "META", "GOOGL",
  "BTC-USD", "ETH-USD",
];

/** The default until November 2026. It led with four indices, two Indian and
    two US, that the site has no source for: the list opened on four rows of
    dashes. */
const OLD_DEFAULT: readonly string[] = [
  "^NSEI", "^NSEBANK", "^GSPC", "^IXIC",
  "AAPL", "NVDA", "TSLA", "AMZN", "MSFT", "META", "GOOGL",
  "BTC-USD", "ETH-USD",
];

/**
 * A stored or synced list, with the old default swapped for the new one.
 *
 * Only an exact match is swapped: the same symbols in the same order. The
 * page saves the default on a first visit, so an untouched copy is not a
 * choice anyone made. A list a person changed in any way, by one symbol or by
 * its order, is theirs and comes back as the same array.
 */
export function migrateWatchlist(list: string[]): string[] {
  const untouched = list.length === OLD_DEFAULT.length && list.every((s, i) => s === OLD_DEFAULT[i]);
  return untouched ? [...DEFAULT_WATCHLIST] : list;
}
