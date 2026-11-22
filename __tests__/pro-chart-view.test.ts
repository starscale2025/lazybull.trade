import { describe, expect, it } from "vitest";
import { fmtAxisTime, fmtBarTime, indexOfTime, isIntraday, keepWindow } from "@/components/pro/chartView";

// Local-time dates, so the labels read the same whatever zone the test runs in.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe("time-axis labels", () => {
  it("an intraday frame shows the clock, and names the day where one begins", () => {
    expect(fmtAxisTime(at(2026, 11, 20, 9, 30), "5m")).toBe("Nov 20"); // the first label
    expect(fmtAxisTime(at(2026, 11, 20, 11, 5), "5m", at(2026, 11, 20, 9, 30))).toBe("11:05");
    expect(fmtAxisTime(at(2026, 11, 21, 9, 30), "5m", at(2026, 11, 20, 15, 55))).toBe("Nov 21");
    expect(fmtAxisTime(at(2026, 11, 20, 14, 0), "1h", at(2026, 11, 20, 10, 0))).toBe("14:00");
  });

  it("a one-minute chart no longer prints one date seven times", () => {
    const ticks = [0, 55, 110, 165, 220, 275, 330].map((m) => at(2026, 11, 20, 9, 30) + m * 60_000);
    const labels = ticks.map((t, k) => fmtAxisTime(t, "1m", k ? ticks[k - 1] : undefined));
    expect(labels).toEqual(["Nov 20", "10:25", "11:20", "12:15", "13:10", "14:05", "15:00"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("daily and weekly bars keep the date with its year; monthly bars are a month and a year", () => {
    expect(fmtAxisTime(at(2026, 11, 20, 10), "D")).toBe("Nov 20, 26");
    expect(fmtAxisTime(at(2026, 11, 16, 10), "W", at(2026, 11, 9, 10))).toBe("Nov 16, 26");
    expect(fmtAxisTime(at(2026, 11, 1, 10), "M")).toBe("Nov 2026");
  });

  it("the crosshair gives day and time on an intraday frame", () => {
    expect(fmtBarTime(at(2026, 11, 20, 14, 35), "5m")).toBe("Nov 20 14:35");
    expect(fmtBarTime(at(2026, 11, 20, 10), "D")).toBe("Nov 20, 26");
    expect(fmtBarTime(at(2026, 11, 1, 10), "M")).toBe("Nov 2026");
  });

  it("knows which frames are shorter than a day", () => {
    for (const tf of ["1m", "5m", "15m", "1h", "4h"]) expect(isIntraday(tf), tf).toBe(true);
    for (const tf of ["D", "W", "M"]) expect(isIntraday(tf), tf).toBe(false);
  });
});

describe("indexOfTime", () => {
  const bars = [10, 20, 30, 40].map((t) => ({ t }));
  it("finds the bar at, or nearest to, a time", () => {
    expect(indexOfTime(bars, 30)).toBe(2);
    expect(indexOfTime(bars, 24)).toBe(1);
    expect(indexOfTime(bars, 26)).toBe(2);
    expect(indexOfTime(bars, 5)).toBe(0);
    expect(indexOfTime(bars, 99)).toBe(3);
    expect(indexOfTime([], 5)).toBe(-1);
  });
});

describe("keepWindow: the view survives a refresh of the same series", () => {
  const series = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ t: (from + i) * 60_000 }));

  it("an identical refetch changes nothing", () => {
    const prev = series(1300);
    expect(keepWindow({ start: 1040, span: 260 }, prev, series(1300))).toEqual({ start: 1040, span: 260 });
    expect(keepWindow({ start: 300, span: 100 }, prev, series(1300))).toEqual({ start: 300, span: 100 });
  });

  it("at the newest bar, a bar added by a tick slides the window with it", () => {
    const prev = series(390);
    const next = series(391);
    expect(keepWindow({ start: 270, span: 120 }, prev, next)).toEqual({ start: 271, span: 120 });
  });

  it("at the newest bar, a feed window that slid by one keeps the same place", () => {
    const prev = series(390);
    const next = series(390, 1); // the oldest bar dropped, a new one added
    expect(keepWindow({ start: 270, span: 120 }, prev, next)).toEqual({ start: 270, span: 120 });
  });

  it("keeps the gap a user left to the right of the newest bar", () => {
    const prev = series(100);
    const next = series(101);
    expect(keepWindow({ start: 50, span: 60 }, prev, next)).toEqual({ start: 51, span: 60 });
  });

  it("scrolled back into history, it holds the same bars by time", () => {
    const prev = series(390);
    const next = series(390, 3); // three minutes later: every bar is three places earlier
    expect(keepWindow({ start: 100, span: 80 }, prev, next)).toEqual({ start: 97, span: 80 });
  });

  it("a locally added bar that the refetch does not list yet steps the window back", () => {
    const prev = series(391);
    const next = series(390);
    expect(keepWindow({ start: 271, span: 120 }, prev, next)).toEqual({ start: 270, span: 120 });
  });

  it("leaves the view alone when either side is empty", () => {
    expect(keepWindow({ start: 5, span: 20 }, [], series(10))).toEqual({ start: 5, span: 20 });
    expect(keepWindow({ start: 5, span: 20 }, series(10), [])).toEqual({ start: 5, span: 20 });
  });
});
