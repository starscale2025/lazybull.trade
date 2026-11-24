// What does this Alpaca plan serve outside the regular US session? (2026-11-24)
//
// Outside 09:30 to 16:00 New York the site stands still: its feed is one
// exchange (IEX), which is shut. For a reader in India that is most of the day.
// Alpaca documents other feeds: `overnight` (its own feed derived from Blue
// Ocean: indicative quotes, trades fifteen minutes late), `boats` (Blue Ocean
// itself), `delayed_sip`, and `sip` history older than fifteen minutes. Its
// pages disagree on which of them a free plan may read.
//
// So this asks: each feed, one symbol, and it reports the HTTP status, how old
// each price was and a cut-down sample. The feed is then built on what these
// keys are served, not on a reading of the docs. It is behind
// /api/status/overnight.
//
// It stays off the provider chain, its cache and its breaker (./health): a 403
// here is an answer, not a failing provider. The report is kept for five
// minutes per instance, so the route cannot be used to spend the plan's calls.
// The symbol is fixed, nothing a caller sends reaches Alpaca, and nothing but
// Alpaca's market data and its own error text comes back.

import { nyMinutes, nyWeekday, usSession, type UsSession } from "./us-session";

const DATA = "https://data.alpaca.markets";
/** One liquid name is enough to learn what a plan is served. */
const SYMBOL = "NVDA";
const MEMO_MS = 5 * 60_000;
const TIMEOUT_MS = 6000;
/** A free plan is served history that ends at least 15 minutes ago; a minute of slack on top. */
const HISTORY_LAG_MS = 16 * 60_000;
/** Far enough back to cross a weekend and reach the last session of each kind. */
const LOOKBACK_MS = 5 * 86_400_000;

type Kind = "snapshot" | "quote" | "bar" | "bars";
type Row = Record<string, unknown>;

export type FeedCheck = {
  /** What was asked, in words. */
  name: string;
  /** The path and query asked of data.alpaca.markets. */
  path: string;
  /** HTTP status; null when no answer came (timeout, network). */
  status: number | null;
  /** How long the answer took. */
  ms: number;
  /** Alpaca's own words on a refusal, or the failure's. */
  error?: string;
  /** Seconds between each price in the answer and the asking. */
  ageS?: Record<string, number | null>;
  /** The answer, cut down to the fields a price is made of. */
  sample?: unknown;
};

export type ProbeReport = {
  /** Keys are present and at least one feed answered. */
  ok: boolean;
  at: number;
  symbol: string;
  /** New York's weekday and clock at the asking, e.g. "Tue 06:41". */
  newYork: string;
  session: UsSession;
  /** The plan's calls per minute and how many were left, from Alpaca's headers. */
  rateLimit?: { limit: number | null; remaining: number | null };
  reason?: string;
  checks: FeedCheck[];
};

const rfc = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function checksAt(now: number): { name: string; path: string; kind: Kind }[] {
  const snap = (feed: string) => `/v2/stocks/snapshots?symbols=${SYMBOL}&feed=${feed}`;
  const hist = (feed: string) =>
    `/v2/stocks/${SYMBOL}/bars?timeframe=1Min&start=${encodeURIComponent(rfc(now - LOOKBACK_MS))}` +
    `&end=${encodeURIComponent(rfc(now - HISTORY_LAG_MS))}&limit=1000&feed=${feed}&sort=desc&adjustment=all`;
  return [
    { name: "snapshot, iex (what the site reads today)", path: snap("iex"), kind: "snapshot" },
    { name: "snapshot, overnight", path: snap("overnight"), kind: "snapshot" },
    { name: "snapshot, boats", path: snap("boats"), kind: "snapshot" },
    { name: "snapshot, delayed_sip", path: snap("delayed_sip"), kind: "snapshot" },
    { name: "latest quote, overnight", path: `/v2/stocks/quotes/latest?symbols=${SYMBOL}&feed=overnight`, kind: "quote" },
    { name: "latest minute bar, overnight", path: `/v2/stocks/bars/latest?symbols=${SYMBOL}&feed=overnight`, kind: "bar" },
    { name: "one-minute bars, boats, ending 16 minutes ago", path: hist("boats"), kind: "bars" },
    { name: "one-minute bars, sip, ending 16 minutes ago", path: hist("sip"), kind: "bars" },
  ];
}

const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

/** Only the named fields, and only plain values: nothing unexpected rides out in a report. */
function pick(v: unknown, keys: string[]): Row | null {
  if (!isRow(v)) return null;
  const out: Row = {};
  for (const k of keys) {
    const x = v[k];
    if (typeof x === "number" || typeof x === "string" || typeof x === "boolean") out[k] = x;
  }
  return out;
}
const QUOTE = ["t", "bp", "bs", "ap", "as", "bx", "ax"];
const TRADE = ["t", "p", "s", "x"];
const BAR = ["t", "o", "h", "l", "c", "v", "n", "vw"];

const msOf = (t: unknown) => (typeof t === "string" ? Date.parse(t) : NaN);
const ageOf = (t: unknown, now: number) => {
  const ms = msOf(t);
  return Number.isFinite(ms) ? Math.round((now - ms) / 1000) : null;
};

function summarise(kind: Kind, body: unknown, now: number): Pick<FeedCheck, "sample" | "ageS"> {
  if (!isRow(body)) return { sample: null };

  if (kind === "snapshot") {
    const s = body[SYMBOL];
    if (!isRow(s)) return { sample: null };
    const sample = {
      latestQuote: pick(s.latestQuote, QUOTE),
      latestTrade: pick(s.latestTrade, TRADE),
      minuteBar: pick(s.minuteBar, BAR),
      dailyBar: pick(s.dailyBar, BAR),
      prevDailyBar: pick(s.prevDailyBar, BAR),
    };
    return {
      sample,
      ageS: {
        quote: ageOf(sample.latestQuote?.t, now),
        trade: ageOf(sample.latestTrade?.t, now),
        minuteBar: ageOf(sample.minuteBar?.t, now),
        dailyBar: ageOf(sample.dailyBar?.t, now),
        prevDailyBar: ageOf(sample.prevDailyBar?.t, now),
      },
    };
  }

  if (kind === "quote") {
    const q = pick(isRow(body.quotes) ? body.quotes[SYMBOL] : null, QUOTE);
    return { sample: q, ageS: { quote: ageOf(q?.t, now) } };
  }

  if (kind === "bar") {
    const b = pick(isRow(body.bars) ? body.bars[SYMBOL] : null, BAR);
    return { sample: b, ageS: { bar: ageOf(b?.t, now) } };
  }

  // History, newest first: how much of it there is, and which stretch of the
  // day each bar belongs to.
  const list: unknown[] = Array.isArray(body.bars) ? body.bars : [];
  const bySession: Record<UsSession, number> = { overnight: 0, pre: 0, regular: 0, post: 0, closed: 0 };
  let zeroVolume = 0;
  for (const b of list) {
    if (!isRow(b)) continue;
    const t = msOf(b.t);
    if (Number.isFinite(t)) bySession[usSession(t)] += 1;
    if (!(Number(b.v) > 0)) zeroVolume += 1;
  }
  return {
    sample: {
      count: list.length,
      more: typeof body.next_page_token === "string" && body.next_page_token !== "",
      bySession,
      zeroVolume,
      newest: list.slice(0, 3).map((b) => pick(b, BAR)),
      oldest: pick(list[list.length - 1], BAR),
    },
    ageS: { newest: ageOf(isRow(list[0]) ? list[0].t : null, now) },
  };
}

type Asked = { check: FeedCheck; rate?: ProbeReport["rateLimit"] };

async function ask(
  c: { name: string; path: string; kind: Kind },
  key: string,
  secret: string,
  now: number
): Promise<Asked> {
  // Alpaca's error text is passed on as it came; the keys are taken out of it
  // in case one is ever echoed back.
  const scrub = (s: string) => s.split(key).join("[key]").split(secret).join("[secret]").slice(0, 200);
  const started = Date.now();
  try {
    const r = await fetch(DATA + c.path, {
      headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await r.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON: the text itself is the message */
    }
    const head = { name: c.name, path: c.path, status: r.status, ms: Date.now() - started };
    const n = (h: string) => {
      const v = Number(r.headers.get(h));
      return r.headers.has(h) && Number.isFinite(v) ? v : null;
    };
    const rate = { limit: n("x-ratelimit-limit"), remaining: n("x-ratelimit-remaining") };
    if (!r.ok) {
      const said = isRow(body) && typeof body.message === "string" ? body.message : text;
      return { check: { ...head, error: scrub(said) }, rate };
    }
    return { check: { ...head, ...summarise(c.kind, body, now) }, rate };
  } catch (e) {
    const err = e as { name?: unknown; message?: unknown } | null;
    const said = err?.name === "TimeoutError" ? "timeout" : typeof err?.message === "string" && err.message ? err.message : "failed";
    return { check: { name: c.name, path: c.path, status: null, ms: Date.now() - started, error: scrub(said) } };
  }
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function nyStamp(ms: number): string {
  const m = nyMinutes(ms);
  const two = (x: number) => String(x).padStart(2, "0");
  return `${DAY[nyWeekday(ms)] ?? "?"} ${two(Math.floor(m / 60))}:${two(m % 60)}`;
}

async function run(now: number, key: string, secret: string): Promise<ProbeReport> {
  const asked = await Promise.all(checksAt(now).map((c) => ask(c, key, secret, now)));
  const rate = asked.find((a) => a.rate && a.rate.limit != null)?.rate;
  const checks = asked.map((a) => a.check);
  return {
    ok: checks.some((c) => c.status === 200),
    at: now,
    symbol: SYMBOL,
    newYork: nyStamp(now),
    session: usSession(now),
    ...(rate ? { rateLimit: rate } : {}),
    checks,
  };
}

let memo: { at: number; report: Promise<ProbeReport> } | null = null;

/** Ask every feed once and report. Kept for five minutes; `ask` never throws, so neither does this. */
export function probeOvernight(now: number = Date.now()): Promise<ProbeReport> {
  const key = process.env.ALPACA_KEY_ID || "";
  const secret = process.env.ALPACA_SECRET || "";
  if (!key || !secret) {
    return Promise.resolve({
      ok: false,
      at: now,
      symbol: SYMBOL,
      newYork: nyStamp(now),
      session: usSession(now),
      reason: "no Alpaca keys on this server",
      checks: [],
    });
  }
  if (memo && now >= memo.at && now - memo.at < MEMO_MS) return memo.report;
  const report = run(now, key, secret);
  memo = { at: now, report };
  return report;
}

/** Test-only: forget the kept report. */
export function __resetProbe(): void {
  memo = null;
}
