import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Alpaca adapter keeps intraday stock bars to the regular session
// (lib/market-data/us-session.ts). The bars below are NVDA's, 23 Nov 2026, as
// the feed listed them: the session's last minutes, then single odd lots after
// the close, which the chart drew as a trail of dashes.

let calls: URL[] = [];
function respond(handler: (u: URL) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      calls.push(u);
      return new Response(JSON.stringify(handler(u)), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
}
async function load() {
  vi.resetModules();
  vi.stubEnv("ALPACA_KEY_ID", "PKTEST");
  vi.stubEnv("ALPACA_SECRET", "secret-test");
  return (await import("@/lib/market-data/alpaca")).alpaca;
}
beforeEach(() => { calls = []; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const bar = (t: string, o: number, h: number, l: number, c: number, v: number) => ({ t, o, h, l, c, v });
// newest first, as the adapter asks for them
const LISTED = [
  bar("2026-11-23T21:49:00Z", 164.84, 164.85, 164.83, 164.85, 600),
  bar("2026-11-23T21:11:00Z", 165.15, 165.15, 165.14, 165.14, 200),
  bar("2026-11-23T21:00:00Z", 165.19, 165.19, 164.78, 164.78, 601),
  bar("2026-11-23T20:59:00Z", 165.06, 165.37, 164.76, 165.25, 253140),
  bar("2026-11-23T20:58:00Z", 165.0, 165.23, 164.76, 165.08, 159295),
  bar("2026-11-23T14:30:00Z", 150.1, 151.0, 149.9, 150.8, 301200),
  bar("2026-11-23T14:12:00Z", 149.5, 149.5, 149.5, 149.5, 100), // before the open
];
const feed = (u: URL) => {
  if (u.pathname === "/v2/clock") return { is_open: false };
  if (u.pathname === "/v2/stocks/snapshots") return {};
  if (u.pathname.endsWith("/bars")) return { bars: LISTED };
  return {};
};
const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

describe("intraday stock bars are the regular session", () => {
  it("drops the prints before the open and after the close, and renumbers", async () => {
    respond(feed);
    const { bars } = await (await load()).getBars("NVDA", "1m");
    expect(bars.map((b) => hhmm(b.t))).toEqual(["14:30", "20:58", "20:59"]);
    expect(bars.map((b) => b.i)).toEqual([0, 1, 2]);
    expect(bars[2]).toMatchObject({ o: 165.06, h: 165.37, l: 164.76, c: 165.25 }); // the session's last minute, as traded
  });

  it("asks for more bars than it keeps, so the prints it drops do not push the open out", async () => {
    respond(feed);
    await (await load()).getBars("NVDA", "1m");
    const req = calls.find((u) => u.pathname.endsWith("/bars"))!;
    expect(Number(req.searchParams.get("limit"))).toBe(Math.ceil(390 * 1.5) + 60);
  });

  it("keeps the newest bars when the session holds more than were wanted", async () => {
    respond(feed);
    const { bars } = await (await load()).getBars("NVDA", "1m", 2);
    expect(bars.map((b) => hhmm(b.t))).toEqual(["20:58", "20:59"]);
    expect(bars.map((b) => b.i)).toEqual([0, 1]);
  });

  it("leaves daily bars and their request alone", async () => {
    respond((u) => (u.pathname.endsWith("/bars") ? { bars: [bar("2026-11-23T05:00:00Z", 167.03, 171.47, 156.96, 165.19, 2e6), bar("2026-11-20T05:00:00Z", 146, 147, 124, 125.65, 3e6)] } : feed(u)));
    const { bars } = await (await load()).getBars("NVDA", "D");
    expect(bars).toHaveLength(2);
    const req = calls.find((u) => u.pathname.endsWith("/bars"))!;
    expect(Number(req.searchParams.get("limit"))).toBe(1300);
  });
});
