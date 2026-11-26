// The weekly set's clock — pure functions of a "now" the caller passes.

import { describe, expect, it } from "vitest";
import { WEEKLY_SET, editionAt, formatCountdown, formatDuration, nextStart, pickEdition, windowFor } from "@/lib/practice/contest";
import { PROBLEMS } from "@/lib/practice/problems";

const ANCHOR = Date.parse(WEEKLY_SET.anchorIso);
const WEEK = 7 * 86_400_000;
const LEN = WEEKLY_SET.durationMin * 60_000;

describe("the weekly window", () => {
  it("anchors on a Sunday 20:00 IST and names four real problems", () => {
    expect(new Date(ANCHOR).getUTCDay()).toBe(0);
    expect(new Date(ANCHOR).getUTCHours() * 60 + new Date(ANCHOR).getUTCMinutes()).toBe(14 * 60 + 30);
    expect(WEEKLY_SET.problems.length).toBe(4);
    for (const s of WEEKLY_SET.problems) expect(PROBLEMS.some((p) => p.id === s)).toBe(true);
  });
  it("nextStart is the anchor before it, then whole weeks after", () => {
    expect(nextStart(ANCHOR - 1)).toBe(ANCHOR);
    expect(nextStart(ANCHOR)).toBe(ANCHOR);
    expect(nextStart(ANCHOR + 1)).toBe(ANCHOR + WEEK);
    expect(nextStart(ANCHOR + WEEK + 5)).toBe(ANCHOR + 2 * WEEK);
  });
  it("windowFor knows every edition from the anchor on, and nothing before", () => {
    expect(windowFor(WEEKLY_SET.num - 1)).toBeNull();
    expect(windowFor(2.5)).toBeNull();
    expect(windowFor(WEEKLY_SET.num)).toEqual({ start: ANCHOR, end: ANCHOR + LEN });
    expect(windowFor(WEEKLY_SET.num + 3)).toEqual({ start: ANCHOR + 3 * WEEK, end: ANCHOR + 3 * WEEK + LEN });
  });
  it("editionAt: upcoming before the anchor, open inside a window, closed after it", () => {
    const before = editionAt(ANCHOR - 1000);
    expect(before).toMatchObject({ num: WEEKLY_SET.num, open: false, upcoming: true });
    const open = editionAt(ANCHOR + WEEK + 10 * 60_000);
    expect(open).toMatchObject({ num: WEEKLY_SET.num + 1, open: true, upcoming: false, start: ANCHOR + WEEK });
    const closed = editionAt(ANCHOR + WEEK + LEN + 1);
    expect(closed).toMatchObject({ num: WEEKLY_SET.num + 1, open: false, upcoming: false });
    // The window the API route uses is the same one editionAt reports.
    expect(windowFor(open.num)).toEqual({ start: open.start, end: open.end });
  });
  it("formats a countdown and a duration, clamping negatives to zero", () => {
    expect(formatCountdown(-5)).toEqual({ d: "00", h: "00", m: "00", s: "00" });
    expect(formatCountdown(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000)).toEqual({ d: "02", h: "03", m: "04", s: "05" });
    expect(formatDuration(58_000)).toBe("58s");
    expect(formatDuration(42 * 60_000 + 7_000)).toBe("42m 07s");
    expect(formatDuration(3_600_000 + 12 * 60_000)).toBe("1h 12m");
    expect(formatDuration(-1)).toBe("0s");
  });
});

describe("which edition a request means", () => {
  const current = WEEKLY_SET.num + 10;

  it("REGRESSION: no `set` at all is the current edition, not the first", () => {
    // Number(null) is 0, a whole number: the route clamped it up to the first
    // edition, so the board said one number under a header that said another
    // and "no past editions yet" on the eleventh.
    expect(pickEdition(null, current)).toBe(current);
    expect(pickEdition(undefined, current)).toBe(current);
  });

  it("a blank or non-numeric `set` is the current edition too", () => {
    for (const raw of ["", " ", "abc", "2.5", "NaN", "14th"]) expect(pickEdition(raw, current), JSON.stringify(raw)).toBe(current);
  });

  it("a number is held to the editions that exist", () => {
    expect(pickEdition(String(WEEKLY_SET.num), current)).toBe(WEEKLY_SET.num);
    expect(pickEdition(String(current - 3), current)).toBe(current - 3);
    expect(pickEdition(" 16 ", current)).toBe(16);
    expect(pickEdition("999", current)).toBe(current); // not a future one
    expect(pickEdition("1", current)).toBe(WEEKLY_SET.num); // nor one before the first
    expect(pickEdition("0", current)).toBe(WEEKLY_SET.num);
    expect(pickEdition("-4", current)).toBe(WEEKLY_SET.num);
  });
});
