import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetProbe, probeOvernight, type FeedCheck } from "@/lib/market-data/overnight-probe";

// The check behind /api/status/overnight asks Alpaca for one symbol on each
// feed that could carry a price outside the regular session, and reports what
// came back. Alpaca is faked here: a free plan as its docs describe one.

const KEY = "PKTESTKEY123";
const SECRET = "secret-test-456";
// Tue 24 Nov 2026, 06:41 in New York (11:41 UTC): pre-market.
const NOW = Date.UTC(2026, 10, 24, 11, 41, 0);

type Call = { url: URL; headers: Record<string, string> };
let calls: Call[] = [];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function respond(handler: (u: URL) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
      return handler(url);
    })
  );
}

const quote = (t: string, bp: number, ap: number) => ({ t, bp, bs: 1, ap, as: 2, bx: "U", ax: "U", c: ["R"], z: "C" });
const trade = (t: string, p: number) => ({ t, p, s: 100, x: "U", i: 7, c: ["@"], z: "C" });
const bar = (t: string, c: number, v = 1000) => ({ t, o: c, h: c, l: c, c, v, n: 3, vw: c });

/** A free plan: the overnight feed answers, Blue Ocean's own snapshot is refused. */
function freePlan(u: URL): Response {
  const feed = u.searchParams.get("feed");
  const limits = { "x-ratelimit-limit": "200", "x-ratelimit-remaining": "187" };
  if (u.pathname === "/v2/stocks/snapshots") {
    if (feed === "boats") return json({ message: `subscription does not permit querying recent boats data for ${KEY}` }, 403);
    return json(
      {
        NVDA: {
          latestQuote: quote("2026-11-24T08:59:58Z", 163.6, 163.72),
          latestTrade: trade("2026-11-24T08:44:10Z", 163.66),
          minuteBar: bar("2026-11-24T08:59:00Z", 163.64),
          dailyBar: bar("2026-11-23T05:00:00Z", 165.19),
          prevDailyBar: bar("2026-11-20T05:00:00Z", 125.65),
          internalNote: { leak: "should never ride out" },
        },
      },
      200,
      limits
    );
  }
  if (u.pathname === "/v2/stocks/quotes/latest") return json({ quotes: { NVDA: quote("2026-11-24T08:59:58Z", 163.6, 163.72) } });
  if (u.pathname === "/v2/stocks/bars/latest") return json({ bars: { NVDA: bar("2026-11-24T08:59:00Z", 163.64) } });
  if (u.pathname === "/v2/stocks/NVDA/bars") {
    // newest first: two overnight minutes, one after-hours, one regular, one pre-market
    return json({
      bars: [
        bar("2026-11-24T08:59:00Z", 163.64), // 03:59 New York: overnight
        bar("2026-11-24T02:00:00Z", 164.1, 0), // 21:00 Monday: overnight, nothing traded
        bar("2026-11-23T22:30:00Z", 164.9), // 17:30: after-hours
        bar("2026-11-23T15:00:00Z", 160.2), // 10:00: regular
        bar("2026-11-23T13:00:00Z", 151.0), // 08:00: pre-market
      ],
      symbol: "NVDA",
      next_page_token: "abc",
    });
  }
  return json({ message: "not found" }, 404);
}

const byName = (checks: FeedCheck[], part: string) => {
  const c = checks.find((x) => x.name.includes(part));
  if (!c) throw new Error(`no check named like "${part}"`);
  return c;
};

beforeEach(() => {
  calls = [];
  __resetProbe();
  vi.stubEnv("ALPACA_KEY_ID", KEY);
  vi.stubEnv("ALPACA_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("probeOvernight", () => {
  it("asks nothing without keys, and says so", async () => {
    vi.stubEnv("ALPACA_KEY_ID", "");
    respond(freePlan);
    const r = await probeOvernight(NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no Alpaca keys/);
    expect(r.checks).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("asks each feed once, of Alpaca's data host only, for the one fixed symbol", async () => {
    respond(freePlan);
    const r = await probeOvernight(NOW);
    expect(calls).toHaveLength(8);
    expect(new Set(calls.map((c) => c.url.origin))).toEqual(new Set(["https://data.alpaca.markets"]));
    for (const c of calls) {
      expect(c.url.pathname + c.url.search).toContain("NVDA");
      expect(c.headers["APCA-API-KEY-ID"]).toBe(KEY);
      expect(c.headers["APCA-API-SECRET-KEY"]).toBe(SECRET);
    }
    const snapshotFeeds = calls.filter((c) => c.url.pathname === "/v2/stocks/snapshots").map((c) => c.url.searchParams.get("feed"));
    expect(snapshotFeeds.sort()).toEqual(["boats", "delayed_sip", "iex", "overnight"]);
    const historyFeeds = calls.filter((c) => c.url.pathname === "/v2/stocks/NVDA/bars").map((c) => c.url.searchParams.get("feed"));
    expect(historyFeeds.sort()).toEqual(["boats", "sip"]);
    // each check reports the path it asked, and no more than the path
    expect(r.checks.map((c) => c.path).sort()).toEqual(calls.map((c) => c.url.pathname + c.url.search).sort());
  });

  it("asks for history that ends more than fifteen minutes ago", async () => {
    respond(freePlan);
    await probeOvernight(NOW);
    for (const c of calls.filter((x) => x.url.pathname === "/v2/stocks/NVDA/bars")) {
      const end = Date.parse(c.url.searchParams.get("end") ?? "");
      const start = Date.parse(c.url.searchParams.get("start") ?? "");
      expect(NOW - end).toBeGreaterThan(15 * 60_000);
      expect(NOW - end).toBeLessThan(20 * 60_000);
      expect(NOW - start).toBe(5 * 86_400_000);
      expect(c.url.searchParams.get("timeframe")).toBe("1Min");
    }
  });

  it("reports the time in New York, the stretch of the day and the plan's limit", async () => {
    respond(freePlan);
    const r = await probeOvernight(NOW);
    expect(r.ok).toBe(true);
    expect(r.symbol).toBe("NVDA");
    expect(r.newYork).toBe("Tue 06:41");
    expect(r.session).toBe("pre");
    expect(r.rateLimit).toEqual({ limit: 200, remaining: 187 });
  });

  it("gives each price's age, and only the fields a price is made of", async () => {
    respond(freePlan);
    const r = await probeOvernight(NOW);
    const c = byName(r.checks, "snapshot, overnight");
    expect(c.status).toBe(200);
    // quote 08:59:58Z against 11:41:00Z
    expect(c.ageS?.quote).toBe(2 * 3600 + 41 * 60 + 2);
    expect(c.ageS?.trade).toBe(2 * 3600 + 56 * 60 + 50);
    const sample = c.sample as Record<string, Record<string, unknown>>;
    expect(sample.latestQuote).toEqual({ t: "2026-11-24T08:59:58Z", bp: 163.6, bs: 1, ap: 163.72, as: 2, bx: "U", ax: "U" });
    expect(sample.latestTrade).toEqual({ t: "2026-11-24T08:44:10Z", p: 163.66, s: 100, x: "U" });
    expect(sample.prevDailyBar.c).toBe(125.65);
    expect(JSON.stringify(r)).not.toContain("should never ride out");
  });

  it("passes a refusal on in Alpaca's words, without the keys", async () => {
    respond(freePlan);
    const r = await probeOvernight(NOW);
    const c = byName(r.checks, "snapshot, boats");
    expect(c.status).toBe(403);
    expect(c.error).toBe("subscription does not permit querying recent boats data for [key]");
    expect(c.sample).toBeUndefined();
    const out = JSON.stringify(r);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain(SECRET);
  });

  it("counts history by the stretch of the day it belongs to", async () => {
    respond(freePlan);
    const r = await probeOvernight(NOW);
    const sample = byName(r.checks, "bars, boats").sample as {
      count: number; more: boolean; zeroVolume: number; bySession: Record<string, number>; newest: unknown[]; oldest: { t: string };
    };
    expect(sample.count).toBe(5);
    expect(sample.more).toBe(true);
    expect(sample.zeroVolume).toBe(1);
    expect(sample.bySession).toEqual({ overnight: 2, pre: 1, regular: 1, post: 1, closed: 0 });
    expect(sample.newest).toHaveLength(3);
    expect(sample.oldest.t).toBe("2026-11-23T13:00:00Z");
  });

  it("reports a feed that never answers and still reports the rest", async () => {
    respond((u) => {
      if (u.pathname === "/v2/stocks/bars/latest") throw new TypeError("fetch failed");
      if (u.pathname === "/v2/stocks/quotes/latest") throw new DOMException("The operation timed out.", "TimeoutError");
      return freePlan(u);
    });
    const r = await probeOvernight(NOW);
    expect(byName(r.checks, "latest minute bar").status).toBeNull();
    expect(byName(r.checks, "latest minute bar").error).toBe("fetch failed");
    expect(byName(r.checks, "latest quote").error).toBe("timeout");
    expect(byName(r.checks, "snapshot, iex").status).toBe(200);
    expect(r.ok).toBe(true);
  });

  it("survives an answer that is not JSON", async () => {
    respond((u) => (u.pathname === "/v2/stocks/snapshots" ? new Response("<html>bad gateway</html>", { status: 502 }) : freePlan(u)));
    const r = await probeOvernight(NOW);
    const c = byName(r.checks, "snapshot, iex");
    expect(c.status).toBe(502);
    expect(c.error).toBe("<html>bad gateway</html>");
  });

  it("is not ok when every feed refuses", async () => {
    respond(() => json({ message: "forbidden." }, 403));
    const r = await probeOvernight(NOW);
    expect(r.ok).toBe(false);
    expect(r.checks.every((c) => c.status === 403 && c.error === "forbidden.")).toBe(true);
    expect(r.rateLimit).toBeUndefined();
  });

  it("keeps its report for five minutes, so the route cannot spend the plan's calls", async () => {
    respond(freePlan);
    const first = await probeOvernight(NOW);
    const again = await probeOvernight(NOW + 4 * 60_000 + 59_000);
    expect(again).toBe(first);
    expect(calls).toHaveLength(8);
    const later = await probeOvernight(NOW + 5 * 60_000);
    expect(later.at).toBe(NOW + 5 * 60_000);
    expect(calls).toHaveLength(16);
  });

  it("shares one asking between callers that arrive together", async () => {
    respond(freePlan);
    const [a, b] = await Promise.all([probeOvernight(NOW), probeOvernight(NOW + 1)]);
    expect(b).toBe(a);
    expect(calls).toHaveLength(8);
  });
});
