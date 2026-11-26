// A symbol with no bars and none coming: the site has no source for it.
//
// The server says so in its "no data" answer (`reason`, from
// lib/market-data/coverage.ts). The terminal then shows an empty pane with one
// sentence. Its made-up practice tape is for a symbol the site does carry
// while the feed is not answering; drawn for an index nobody here sells data
// for, it was an invented chart of a real market.

/** Told from the name alone: an index (^GSPC) or an Indian listing (.NS, .BO).
    Used only when the server could not be asked, because the request itself
    failed; otherwise the server's own reason decides. */
export const namedNoFeed = (sym: string): boolean => sym.startsWith("^") || /\.(NS|BO)$/i.test(sym);

/** Does a failed bars request mean "nothing here carries this symbol"?
    `answer` is the parsed body, or null when there was none to parse. */
export function isNoFeed(answer: { reason?: unknown } | null, sym: string): boolean {
  return answer ? answer.reason === "no_feed" : namedNoFeed(sym);
}

/** The sentence the empty chart shows. */
export const noFeedNote = (sym: string): string => `No price data for ${sym} here.`;
