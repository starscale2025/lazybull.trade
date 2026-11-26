// What this deployment can price, judged from the symbol alone.
//
// The quote chain answers a miss with null whether a provider is down or no
// provider was ever going to carry the symbol, and the client used to treat
// the two alike: any miss drew a made-up tape. For a listed stock during an
// outage that is the labelled practice tape it was meant to be. For an index
// nobody here sells data for, it was an invented chart of a real market (the
// S&P 500 drawn near 5,600 with the real one above 7,000).
//
// Server only: it pulls in the symbol list and two adapters. Import it from
// routes, never from a client file.

import { isIndianSecurity } from "@/lib/region";
import { isCrypto } from "./provider";
import { SYMBOL_UNIVERSE } from "./symbols";
import { twelvedata } from "./twelvedata";
import { yahoo } from "./yahoo";

/** A US ticker as an exchange writes one: AAPL, F, BRK.B. */
const US_TICKER = /^[A-Z]{1,5}(\.[A-Z])?$/;

/** Is a source configured that carries indices and Indian names? Alpaca, the
    production feed, carries neither: US stocks, funds and crypto only. */
const broadSource = () => yahoo.available() || twelvedata.available();

/** Can this deployment price `sym` at all? */
export function priceable(sym: string): boolean {
  if (broadSource()) return true;
  const s = sym.trim().toUpperCase();
  if (isIndianSecurity(s)) return false;
  return isCrypto(s) || US_TICKER.test(s);
}

/**
 * Why a symbol came back with no bars.
 *   no_feed    nothing here carries it, or it is a ticker nobody listed: there
 *              is nothing to wait for, so the page says so and draws no candles
 *   feed_down  a symbol the site does carry, missing for now: the page may
 *              fall back to its labelled practice tape
 */
export function missReason(sym: string): "no_feed" | "feed_down" {
  const s = sym.trim().toUpperCase();
  if (!priceable(s)) return "no_feed";
  return isCrypto(s) || SYMBOL_UNIVERSE.some((e) => e.sym === s) ? "feed_down" : "no_feed";
}
