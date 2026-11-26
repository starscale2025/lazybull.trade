// The builder's event pins are published dates, and only those.

import { describe, expect, it } from "vitest";
import { EVENTS_KNOWN_UNTIL, scheduledEvents } from "@/lib/events";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("scheduledEvents", () => {
  it("lists the Fed decision and the inflation report of December 2026", () => {
    const got = scheduledEvents(day("2026-11-25"), day("2026-12-30"));
    expect(got.map((e) => `${e.date} ${e.kind}`)).toEqual(["2026-12-09 fed", "2026-12-10 cpi"]);
  });

  it("never pins a company's earnings or dividend: there is no licensed calendar for them", () => {
    const year = scheduledEvents(day("2026-11-25"), day("2027-11-25"));
    expect(year.length).toBeGreaterThan(15);
    for (const e of year) {
      expect(["fed", "cpi"]).toContain(e.kind);
      expect(e.title).not.toMatch(/earnings|dividend/i);
    }
  });

  it("is the same for every stock: nothing in it is about one company", () => {
    // The old calendar took the ticker and hashed it into dates.
    expect(scheduledEvents.length).toBe(2);
  });

  it("includes both ends of the window, and counts today's event whatever the hour", () => {
    const lateOnTheDay = new Date("2026-12-09T23:30:00Z");
    expect(scheduledEvents(lateOnTheDay, day("2026-12-09")).map((e) => e.date)).toEqual(["2026-12-09"]);
    expect(scheduledEvents(day("2026-12-10"), day("2026-12-10")).map((e) => e.kind)).toEqual(["cpi"]);
  });

  it("names the strategy meeting as the Federal Reserve lists it", () => {
    const oct = scheduledEvents(day("2027-10-20"), day("2027-10-31"));
    expect(oct.map((e) => e.title)).toEqual(["Fed strategy meeting"]);
  });

  it("puts every date on a weekday, in order, each once", () => {
    const all = scheduledEvents(day("2026-01-01"), day("2029-01-01"));
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...all].sort((a, b) => a.date.localeCompare(b.date))).toEqual(all);
    for (const e of all) {
      const dow = new Date(`${e.date}T00:00:00Z`).getUTCDay();
      expect(dow, e.date).toBeGreaterThan(0);
      expect(dow, e.date).toBeLessThan(6);
    }
  });

  it("shows nothing past what has been published, and says how far that is", () => {
    expect(scheduledEvents(day("2028-03-01"), day("2028-12-31"))).toEqual([]);
    expect(EVENTS_KNOWN_UNTIL).toBe("2027-12-10");
  });
});
