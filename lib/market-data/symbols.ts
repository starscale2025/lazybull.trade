// The symbols the pickers search when Yahoo is off, which is always in
// production (lib/market-data/yahoo.ts: an unlicensed scrape, never on in
// prod). Any ticker not listed here can still be typed in and opened: the
// quote chain tries every configured provider and labels what it can't price.
//
// exch is a display label only; nothing routes on it.

import { typedTicker } from "./ticker";

export type SymbolEntry = { sym: string; name: string; exch: string };

export const SYMBOL_UNIVERSE: SymbolEntry[] = [
  // US: the names people look for first
  { sym: "AAPL", name: "Apple Inc.", exch: "NASDAQ" },
  { sym: "MSFT", name: "Microsoft Corp.", exch: "NASDAQ" },
  { sym: "NVDA", name: "Nvidia Corp.", exch: "NASDAQ" },
  { sym: "AMZN", name: "Amazon.com Inc.", exch: "NASDAQ" },
  { sym: "GOOGL", name: "Alphabet Inc. Class A", exch: "NASDAQ" },
  { sym: "GOOG", name: "Alphabet Inc. Class C", exch: "NASDAQ" },
  { sym: "META", name: "Meta Platforms Inc.", exch: "NASDAQ" },
  { sym: "TSLA", name: "Tesla Inc.", exch: "NASDAQ" },
  { sym: "AVGO", name: "Broadcom Inc.", exch: "NASDAQ" },
  { sym: "NFLX", name: "Netflix Inc.", exch: "NASDAQ" },
  { sym: "AMD", name: "Advanced Micro Devices", exch: "NASDAQ" },
  { sym: "INTC", name: "Intel Corp.", exch: "NASDAQ" },
  { sym: "QCOM", name: "Qualcomm Inc.", exch: "NASDAQ" },
  { sym: "TXN", name: "Texas Instruments", exch: "NASDAQ" },
  { sym: "MU", name: "Micron Technology", exch: "NASDAQ" },
  { sym: "AMAT", name: "Applied Materials", exch: "NASDAQ" },
  { sym: "LRCX", name: "Lam Research", exch: "NASDAQ" },
  { sym: "KLAC", name: "KLA Corp.", exch: "NASDAQ" },
  { sym: "MRVL", name: "Marvell Technology", exch: "NASDAQ" },
  { sym: "ARM", name: "Arm Holdings", exch: "NASDAQ" },
  { sym: "ASML", name: "ASML Holding", exch: "NASDAQ" },
  { sym: "SMCI", name: "Super Micro Computer", exch: "NASDAQ" },
  { sym: "ADBE", name: "Adobe Inc.", exch: "NASDAQ" },
  { sym: "INTU", name: "Intuit Inc.", exch: "NASDAQ" },
  { sym: "CSCO", name: "Cisco Systems", exch: "NASDAQ" },
  { sym: "PANW", name: "Palo Alto Networks", exch: "NASDAQ" },
  { sym: "CRWD", name: "CrowdStrike Holdings", exch: "NASDAQ" },
  { sym: "PLTR", name: "Palantir Technologies", exch: "NASDAQ" },
  { sym: "DDOG", name: "Datadog Inc.", exch: "NASDAQ" },
  { sym: "ZS", name: "Zscaler Inc.", exch: "NASDAQ" },
  { sym: "WDAY", name: "Workday Inc.", exch: "NASDAQ" },
  { sym: "TEAM", name: "Atlassian Corp.", exch: "NASDAQ" },
  { sym: "APP", name: "AppLovin Corp.", exch: "NASDAQ" },
  { sym: "TTD", name: "The Trade Desk", exch: "NASDAQ" },
  { sym: "COST", name: "Costco Wholesale", exch: "NASDAQ" },
  { sym: "WMT", name: "Walmart Inc.", exch: "NASDAQ" },
  { sym: "PEP", name: "PepsiCo Inc.", exch: "NASDAQ" },
  { sym: "SBUX", name: "Starbucks Corp.", exch: "NASDAQ" },
  { sym: "MDLZ", name: "Mondelez International", exch: "NASDAQ" },
  { sym: "BKNG", name: "Booking Holdings", exch: "NASDAQ" },
  { sym: "ABNB", name: "Airbnb Inc.", exch: "NASDAQ" },
  { sym: "DASH", name: "DoorDash Inc.", exch: "NASDAQ" },
  { sym: "MELI", name: "MercadoLibre Inc.", exch: "NASDAQ" },
  { sym: "PDD", name: "PDD Holdings", exch: "NASDAQ" },
  { sym: "PYPL", name: "PayPal Holdings", exch: "NASDAQ" },
  { sym: "COIN", name: "Coinbase Global", exch: "NASDAQ" },
  { sym: "HOOD", name: "Robinhood Markets", exch: "NASDAQ" },
  { sym: "SOFI", name: "SoFi Technologies", exch: "NASDAQ" },
  { sym: "RIVN", name: "Rivian Automotive", exch: "NASDAQ" },
  { sym: "LCID", name: "Lucid Group", exch: "NASDAQ" },
  { sym: "ROKU", name: "Roku Inc.", exch: "NASDAQ" },
  { sym: "CMCSA", name: "Comcast Corp.", exch: "NASDAQ" },
  { sym: "TMUS", name: "T-Mobile US", exch: "NASDAQ" },
  { sym: "ADP", name: "Automatic Data Processing", exch: "NASDAQ" },
  { sym: "HON", name: "Honeywell International", exch: "NASDAQ" },
  { sym: "LIN", name: "Linde plc", exch: "NASDAQ" },
  { sym: "ISRG", name: "Intuitive Surgical", exch: "NASDAQ" },
  { sym: "GILD", name: "Gilead Sciences", exch: "NASDAQ" },
  { sym: "AMGN", name: "Amgen Inc.", exch: "NASDAQ" },
  { sym: "VRTX", name: "Vertex Pharmaceuticals", exch: "NASDAQ" },
  { sym: "REGN", name: "Regeneron Pharmaceuticals", exch: "NASDAQ" },
  { sym: "JPM", name: "JPMorgan Chase & Co.", exch: "NYSE" },
  { sym: "BAC", name: "Bank of America", exch: "NYSE" },
  { sym: "WFC", name: "Wells Fargo & Co.", exch: "NYSE" },
  { sym: "C", name: "Citigroup Inc.", exch: "NYSE" },
  { sym: "GS", name: "Goldman Sachs Group", exch: "NYSE" },
  { sym: "MS", name: "Morgan Stanley", exch: "NYSE" },
  { sym: "SCHW", name: "Charles Schwab Corp.", exch: "NYSE" },
  { sym: "BLK", name: "BlackRock Inc.", exch: "NYSE" },
  { sym: "AXP", name: "American Express", exch: "NYSE" },
  { sym: "V", name: "Visa Inc.", exch: "NYSE" },
  { sym: "MA", name: "Mastercard Inc.", exch: "NYSE" },
  { sym: "UNH", name: "UnitedHealth Group", exch: "NYSE" },
  { sym: "JNJ", name: "Johnson & Johnson", exch: "NYSE" },
  { sym: "LLY", name: "Eli Lilly and Co.", exch: "NYSE" },
  { sym: "PFE", name: "Pfizer Inc.", exch: "NYSE" },
  { sym: "MRK", name: "Merck & Co.", exch: "NYSE" },
  { sym: "ABBV", name: "AbbVie Inc.", exch: "NYSE" },
  { sym: "ABT", name: "Abbott Laboratories", exch: "NYSE" },
  { sym: "TMO", name: "Thermo Fisher Scientific", exch: "NYSE" },
  { sym: "DHR", name: "Danaher Corp.", exch: "NYSE" },
  { sym: "XOM", name: "Exxon Mobil Corp.", exch: "NYSE" },
  { sym: "CVX", name: "Chevron Corp.", exch: "NYSE" },
  { sym: "COP", name: "ConocoPhillips", exch: "NYSE" },
  { sym: "OXY", name: "Occidental Petroleum", exch: "NYSE" },
  { sym: "PG", name: "Procter & Gamble", exch: "NYSE" },
  { sym: "KO", name: "Coca-Cola Co.", exch: "NYSE" },
  { sym: "PM", name: "Philip Morris International", exch: "NYSE" },
  { sym: "MCD", name: "McDonald's Corp.", exch: "NYSE" },
  { sym: "NKE", name: "Nike Inc.", exch: "NYSE" },
  { sym: "DIS", name: "Walt Disney Co.", exch: "NYSE" },
  { sym: "HD", name: "Home Depot", exch: "NYSE" },
  { sym: "LOW", name: "Lowe's Companies", exch: "NYSE" },
  { sym: "TGT", name: "Target Corp.", exch: "NYSE" },
  { sym: "ORCL", name: "Oracle Corp.", exch: "NYSE" },
  { sym: "CRM", name: "Salesforce Inc.", exch: "NYSE" },
  { sym: "IBM", name: "IBM", exch: "NYSE" },
  { sym: "NOW", name: "ServiceNow Inc.", exch: "NYSE" },
  { sym: "ACN", name: "Accenture plc", exch: "NYSE" },
  { sym: "ANET", name: "Arista Networks", exch: "NYSE" },
  { sym: "DELL", name: "Dell Technologies", exch: "NYSE" },
  { sym: "SNOW", name: "Snowflake Inc.", exch: "NYSE" },
  { sym: "NET", name: "Cloudflare Inc.", exch: "NYSE" },
  { sym: "UBER", name: "Uber Technologies", exch: "NYSE" },
  { sym: "SPOT", name: "Spotify Technology", exch: "NYSE" },
  { sym: "TSM", name: "Taiwan Semiconductor", exch: "NYSE" },
  { sym: "BABA", name: "Alibaba Group", exch: "NYSE" },
  { sym: "NIO", name: "NIO Inc.", exch: "NYSE" },
  { sym: "BA", name: "Boeing Co.", exch: "NYSE" },
  { sym: "CAT", name: "Caterpillar Inc.", exch: "NYSE" },
  { sym: "DE", name: "Deere & Co.", exch: "NYSE" },
  { sym: "GE", name: "GE Aerospace", exch: "NYSE" },
  { sym: "LMT", name: "Lockheed Martin", exch: "NYSE" },
  { sym: "RTX", name: "RTX Corp.", exch: "NYSE" },
  { sym: "UPS", name: "United Parcel Service", exch: "NYSE" },
  { sym: "UNP", name: "Union Pacific", exch: "NYSE" },
  { sym: "F", name: "Ford Motor Co.", exch: "NYSE" },
  { sym: "GM", name: "General Motors", exch: "NYSE" },
  { sym: "T", name: "AT&T Inc.", exch: "NYSE" },
  { sym: "VZ", name: "Verizon Communications", exch: "NYSE" },

  // US funds
  { sym: "SPY", name: "SPDR S&P 500 ETF", exch: "ARCA" },
  { sym: "VOO", name: "Vanguard S&P 500 ETF", exch: "ARCA" },
  { sym: "VTI", name: "Vanguard Total Stock Market ETF", exch: "ARCA" },
  { sym: "QQQ", name: "Invesco QQQ Trust", exch: "NASDAQ" },
  { sym: "DIA", name: "SPDR Dow Jones Industrial Average ETF", exch: "ARCA" },
  { sym: "IWM", name: "iShares Russell 2000 ETF", exch: "ARCA" },
  { sym: "TQQQ", name: "ProShares UltraPro QQQ", exch: "NASDAQ" },
  { sym: "SQQQ", name: "ProShares UltraPro Short QQQ", exch: "NASDAQ" },
  { sym: "SMH", name: "VanEck Semiconductor ETF", exch: "NASDAQ" },
  { sym: "XLK", name: "Technology Select Sector SPDR", exch: "ARCA" },
  { sym: "XLF", name: "Financial Select Sector SPDR", exch: "ARCA" },
  { sym: "XLE", name: "Energy Select Sector SPDR", exch: "ARCA" },
  { sym: "ARKK", name: "ARK Innovation ETF", exch: "ARCA" },
  { sym: "TLT", name: "iShares 20+ Year Treasury Bond ETF", exch: "NASDAQ" },
  { sym: "GLD", name: "SPDR Gold Shares", exch: "ARCA" },
  { sym: "SLV", name: "iShares Silver Trust", exch: "ARCA" },
  { sym: "EEM", name: "iShares MSCI Emerging Markets ETF", exch: "ARCA" },
  { sym: "INDA", name: "iShares MSCI India ETF", exch: "CBOE" },
  { sym: "IBIT", name: "iShares Bitcoin Trust", exch: "NASDAQ" },

  // Crypto, in the form the quote chain expects
  { sym: "BTC-USD", name: "Bitcoin", exch: "CRYPTO" },
  { sym: "ETH-USD", name: "Ethereum", exch: "CRYPTO" },
  { sym: "SOL-USD", name: "Solana", exch: "CRYPTO" },
  { sym: "DOGE-USD", name: "Dogecoin", exch: "CRYPTO" },
  { sym: "LTC-USD", name: "Litecoin", exch: "CRYPTO" },
  { sym: "AVAX-USD", name: "Avalanche", exch: "CRYPTO" },
  { sym: "LINK-USD", name: "Chainlink", exch: "CRYPTO" },

  // Indices
  { sym: "^GSPC", name: "S&P 500", exch: "INDEX" },
  { sym: "^IXIC", name: "Nasdaq Composite", exch: "INDEX" },
  { sym: "^NSEI", name: "Nifty 50 Index", exch: "NSE" },
  { sym: "^NSEBANK", name: "Bank Nifty", exch: "NSE" },

  // India (31 days behind under the education lag, lib/region.ts)
  { sym: "RELIANCE.NS", name: "Reliance Industries", exch: "NSE" },
  { sym: "TCS.NS", name: "Tata Consultancy Services", exch: "NSE" },
  { sym: "HDFCBANK.NS", name: "HDFC Bank", exch: "NSE" },
  { sym: "ICICIBANK.NS", name: "ICICI Bank", exch: "NSE" },
  { sym: "INFY.NS", name: "Infosys", exch: "NSE" },
  { sym: "SBIN.NS", name: "State Bank of India", exch: "NSE" },
  { sym: "BHARTIARTL.NS", name: "Bharti Airtel", exch: "NSE" },
  { sym: "ITC.NS", name: "ITC Ltd.", exch: "NSE" },
  { sym: "LT.NS", name: "Larsen & Toubro", exch: "NSE" },
  { sym: "HINDUNILVR.NS", name: "Hindustan Unilever", exch: "NSE" },
];

/** The ticker without its decorations: ^NSEI → NSEI, BTC-USD → BTC, TCS.NS → TCS. */
function bare(sym: string): string {
  return sym.replace(/^\^/, "").replace(/-USD$/, "").replace(/\.NS$/, "");
}

/**
 * Search the list by ticker and by name: an exact ticker first, then tickers
 * that start with the query, then names with a word that does, then names
 * that merely contain it.
 */
export function searchSymbols(query: string, limit = 12): SymbolEntry[] {
  const q = query.trim();
  if (!q) return [];
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();
  const scored: { e: SymbolEntry; score: number }[] = [];
  for (const e of SYMBOL_UNIVERSE) {
    const sym = e.sym.toUpperCase();
    const b = bare(sym);
    const name = e.name.toLowerCase();
    let score = 0;
    if (sym === upper || b === upper) score = 100;
    else if (sym.startsWith(upper) || b.startsWith(upper)) score = 80 - (sym.length - upper.length);
    else if (name.split(/[^a-z0-9]+/).some((w) => w.startsWith(lower))) score = 50;
    else if (name.includes(lower)) score = 40;
    if (score) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.sym.length - b.e.sym.length || a.e.sym.localeCompare(b.e.sym));
  return scored.slice(0, limit).map((s) => s.e);
}

/**
 * The list's matches, plus the query itself as a ticker to open when the list
 * has no exact match, so any symbol a provider knows stays reachable.
 */
export function searchWithTyped(query: string, limit = 12): (SymbolEntry & { typed?: true })[] {
  const items: (SymbolEntry & { typed?: true })[] = searchSymbols(query, limit);
  const t = typedTicker(query);
  if (t && !items.some((i) => i.sym === t.sym)) items.push({ ...t, typed: true });
  return items;
}
