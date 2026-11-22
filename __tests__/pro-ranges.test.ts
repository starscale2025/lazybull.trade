import { describe, expect, it } from "vitest";
import { RANGE_MIN_BARS, RANGE_PRESETS, rangeBars, rangePlan, rangeStart } from "@/lib/pro/ranges";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** `days` regular US sessions of bars `stepMin` long, ending on Fri 20 Nov 2026. Weekends skipped. */
function sessions(days: number, stepMin: number): { t: number }[] {
  const out: { t: number }[] = [];
  const perDay = 390 / stepMin;
  let d = Date.UTC(2026, 10, 20, 14, 30); // the last session's open
  const opens: number[] = [];
  while (opens.length < days) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) opens.unshift(d);
    d -= DAY;
  }
  for (const open of opens) for (let k = 0; k < perDay; k++) out.push({ t: open + k * stepMin * MIN });
  return out;
}
/** A market that never shuts: `count` bars `stepMs` apart, ending now-ish. */
const continuous = (count: number, stepMs: number) => Array.from({ length: count }, (_, i) => ({ t: Date.UTC(2026, 10, 22, 10, 50) - (count - 1 - i) * stepMs }));
/** One bar a day at midnight UTC, `count` of them, ending 20 Nov 2026 (weekends included: only the dates matter here). */
const daily = (count: number) => Array.from({ length: count }, (_, i) => ({ t: Date.UTC(2026, 10, 20) - (count - 1 - i) * DAY }));

describe("rangePlan", () => {
  it("has a plan for every button", () => {
    for (const p of RANGE_PRESETS) expect(rangePlan(p, "AAPL"), p).not.toBeNull();
    expect(rangePlan("2W", "AAPL")).toBeNull();
  });

  it("gives each range a bar size that suits it", () => {
    expect(rangePlan("1D", "AAPL")?.tf).toBe("5m");
    expect(rangePlan("5D", "AAPL")?.tf).toBe("15m");
    expect(rangePlan("1M", "AAPL")?.tf).toBe("1h");
    for (const p of ["3M", "6M", "YTD", "1Y"]) expect(rangePlan(p, "AAPL")?.tf, p).toBe("D");
    expect(rangePlan("5Y", "AAPL")?.tf).toBe("W");
    expect(rangePlan("All", "AAPL")?.tf).toBe("M");
  });

  it("uses coarser bars for crypto where its intraday history is short", () => {
    expect(rangePlan("1D", "BTC-USD")).toEqual({ tf: "5m", kind: "days", n: 1 });
    expect(rangePlan("5D", "BTC-USD")?.tf).toBe("1h");
    expect(rangePlan("1M", "BTC-USD")?.tf).toBe("D");
    expect(rangePlan("1Y", "ETH")?.tf).toBe("D");
  });

  it("a longer range never asks for a finer bar than a shorter one", () => {
    const order = ["1m", "5m", "15m", "1h", "4h", "D", "W", "M"];
    for (const sym of ["AAPL", "BTC-USD"]) {
      let prev = -1;
      for (const p of RANGE_PRESETS) {
        const at = order.indexOf(rangePlan(p, sym)!.tf);
        expect(at, `${sym} ${p}`).toBeGreaterThanOrEqual(prev);
        prev = at;
      }
    }
  });
});

describe("rangeStart", () => {
  it("1D is the last session, whole", () => {
    const bars = sessions(5, 5); // five days of 5-minute bars: what the feed sends
    expect(rangeBars(bars, rangePlan("1D", "AAPL")!)).toBe(78);
  });

  it("1D is the session so far once the next one has begun", () => {
    const bars = [...sessions(5, 5)];
    const open = Date.UTC(2026, 10, 23, 14, 30); // Monday
    for (let k = 0; k < 30; k++) bars.push({ t: open + k * 5 * MIN });
    expect(rangeBars(bars, rangePlan("1D", "AAPL")!)).toBe(30);
  });

  it("minutes into a session 1D still leaves a chart to read", () => {
    const bars = [...sessions(5, 5)];
    const open = Date.UTC(2026, 10, 23, 14, 30);
    for (let k = 0; k < 3; k++) bars.push({ t: open + k * 5 * MIN });
    expect(rangeBars(bars, rangePlan("1D", "AAPL")!)).toBe(RANGE_MIN_BARS);
  });

  it("5D is five sessions, counted across the weekend", () => {
    const bars = sessions(17, 15); // seventeen days of 15-minute bars
    expect(rangeBars(bars, rangePlan("5D", "AAPL")!)).toBe(5 * 26);
  });

  it("shows what there is when the feed holds fewer sessions than asked", () => {
    const bars = sessions(3, 15);
    expect(rangeStart(bars, rangePlan("5D", "AAPL")!)).toBe(0);
  });

  it("a market that never shuts is counted in plain days", () => {
    const fiveMin = continuous(390, 5 * MIN); // 32.5 hours of crypto
    expect(rangeBars(fiveMin, rangePlan("1D", "BTC-USD")!)).toBe(288);
    const hourly = continuous(167, HOUR); // a week
    expect(rangeBars(hourly, rangePlan("5D", "BTC-USD")!)).toBe(120);
  });

  it("a stock plan on bars with no breaks falls back to days (the made-up tape)", () => {
    const bars = continuous(300, 5 * MIN);
    expect(rangeBars(bars, rangePlan("1D", "AAPL")!)).toBe(288);
  });

  it("months and years are calendar spans back from the last bar", () => {
    const bars = daily(2000);
    expect(rangeBars(bars, rangePlan("3M", "AAPL")!)).toBe(91);
    expect(rangeBars(bars, rangePlan("6M", "AAPL")!)).toBe(182);
    expect(rangeBars(bars, rangePlan("1Y", "AAPL")!)).toBe(365);
  });

  it("YTD starts on the first bar of the last bar's year", () => {
    const bars = daily(2000);
    const from = rangeStart(bars, rangePlan("YTD", "AAPL")!);
    expect(new Date(bars[from].t).toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(new Date(bars[from - 1].t).getUTCFullYear()).toBe(2025);
  });

  it("All is every bar, and a short history is shown whole", () => {
    expect(rangeStart(daily(77), rangePlan("All", "AAPL")!)).toBe(0);
    expect(rangeStart(daily(40), rangePlan("1Y", "AAPL")!)).toBe(0); // forty days of bars for a year
  });

  it("copes with an empty or one-bar series", () => {
    expect(rangeStart([], rangePlan("1D", "AAPL")!)).toBe(0);
    expect(rangeStart([{ t: 1 }], rangePlan("1Y", "AAPL")!)).toBe(0);
  });
});
