import { describe, expect, it } from "vitest";
import { inRegularSession, nyMinutes, nyWeekday, regularSessionBars, usSession } from "@/lib/market-data/us-session";

const MIN = 60_000, HOUR = 3_600_000;
// Winter (EST, UTC-5): the session is 14:30 to 21:00 UTC. Summer (EDT, UTC-4): 13:30 to 20:00 UTC.
const winter = (h: number, m = 0) => Date.UTC(2026, 10, 23, h, m); // Mon 23 Nov 2026
const summer = (h: number, m = 0) => Date.UTC(2026, 6, 14, h, m); // Tue 14 Jul 2026

describe("nyMinutes", () => {
  it("reads New York's clock in winter and in summer", () => {
    expect(nyMinutes(winter(14, 30))).toBe(9 * 60 + 30);
    expect(nyMinutes(summer(13, 30))).toBe(9 * 60 + 30);
    expect(nyMinutes(winter(5, 0))).toBe(0); // midnight is 0, not 24:00
  });
});

describe("inRegularSession", () => {
  it("keeps the session's first and last minute and drops the minutes either side", () => {
    expect(inRegularSession(winter(14, 30), MIN)).toBe(true);
    expect(inRegularSession(winter(20, 59), MIN)).toBe(true);
    expect(inRegularSession(winter(14, 29), MIN)).toBe(false);
    expect(inRegularSession(winter(21, 0), MIN)).toBe(false);
    expect(inRegularSession(winter(21, 49), MIN)).toBe(false); // the last dash on the owner's screenshot
  });

  it("follows daylight saving", () => {
    expect(inRegularSession(summer(13, 30), MIN)).toBe(true);
    expect(inRegularSession(summer(20, 0), MIN)).toBe(false);
    expect(inRegularSession(summer(14, 30), MIN)).toBe(true);
    expect(inRegularSession(summer(13, 29), MIN)).toBe(false);
  });

  it("a five-minute bar that ends on the open is before it; one that starts at the close is after it", () => {
    expect(inRegularSession(winter(14, 25), 5 * MIN)).toBe(false);
    expect(inRegularSession(winter(14, 30), 5 * MIN)).toBe(true);
    expect(inRegularSession(winter(20, 55), 5 * MIN)).toBe(true);
    expect(inRegularSession(winter(21, 0), 5 * MIN)).toBe(false);
  });

  it("an hourly or four-hour bar counts when any of it is in the session", () => {
    expect(inRegularSession(winter(14, 0), HOUR)).toBe(true); // 09:00 to 10:00 holds 09:30 to 10:00
    expect(inRegularSession(winter(13, 0), HOUR)).toBe(false); // 08:00 to 09:00
    expect(inRegularSession(winter(20, 0), HOUR)).toBe(true); // 15:00 to 16:00
    expect(inRegularSession(winter(21, 0), HOUR)).toBe(false); // 16:00 to 17:00
    expect(inRegularSession(winter(12, 0), 4 * HOUR)).toBe(true); // 07:00 to 11:00
    expect(inRegularSession(winter(20, 0), 4 * HOUR)).toBe(true); // 15:00 to 19:00
    expect(inRegularSession(Date.UTC(2026, 10, 24, 0, 0), 4 * HOUR)).toBe(false); // 19:00 to 23:00
    expect(inRegularSession(winter(8, 0), 4 * HOUR)).toBe(false); // 03:00 to 07:00
  });
});

describe("regularSessionBars", () => {
  const bar = (t: number, i: number) => ({ i, t, c: 1 });

  it("drops the after-hours prints and renumbers what is left", () => {
    const bars = [bar(winter(20, 58), 0), bar(winter(20, 59), 1), bar(winter(21, 0), 2), bar(winter(21, 11), 3), bar(winter(21, 49), 4)];
    const out = regularSessionBars(bars, "1m");
    expect(out.map((b) => b.t)).toEqual([winter(20, 58), winter(20, 59)]);
    expect(out.map((b) => b.i)).toEqual([0, 1]);
  });

  it("drops the pre-market prints too, so the index stays consecutive across days", () => {
    const tue = (h: number, m: number) => Date.UTC(2026, 10, 24, h, m);
    const bars = [bar(winter(20, 59), 0), bar(winter(21, 3), 1), bar(tue(13, 5), 2), bar(tue(14, 30), 3), bar(tue(14, 31), 4)];
    const out = regularSessionBars(bars, "1m");
    expect(out.map((b) => b.t)).toEqual([winter(20, 59), tue(14, 30), tue(14, 31)]);
    expect(out.map((b) => b.i)).toEqual([0, 1, 2]);
  });

  it("returns the same array when nothing is outside the session", () => {
    const bars = [bar(winter(15, 0), 0), bar(winter(15, 1), 1)];
    expect(regularSessionBars(bars, "1m")).toBe(bars);
  });

  it("leaves daily, weekly and monthly bars alone", () => {
    const bars = [bar(Date.UTC(2026, 10, 20, 5), 0), bar(Date.UTC(2026, 10, 23, 5), 1)]; // midnight New York
    for (const tf of ["D", "W", "M"]) expect(regularSessionBars(bars, tf)).toBe(bars);
  });
});

describe("usSession", () => {
  // New York is UTC-5 in November: Sun 22, Mon 23 ... Fri 27, Sat 28 Nov 2026.
  const nov = (day: number, h: number, m = 0) => Date.UTC(2026, 10, day, h, m);

  it("reads New York's weekday, not UTC's", () => {
    expect(nyWeekday(nov(23, 1))).toBe(0); // 20:00 on Sunday in New York, already Monday in UTC
    expect(nyWeekday(nov(23, 5))).toBe(1); // midnight, Monday
    expect(nyWeekday(nov(28, 17))).toBe(6);
  });

  it("walks a weekday through its four stretches", () => {
    expect(usSession(nov(23, 8, 59))).toBe("overnight"); // 03:59
    expect(usSession(nov(23, 9, 0))).toBe("pre"); // 04:00
    expect(usSession(nov(23, 14, 29))).toBe("pre");
    expect(usSession(nov(23, 14, 30))).toBe("regular"); // 09:30
    expect(usSession(nov(23, 20, 59))).toBe("regular");
    expect(usSession(nov(23, 21, 0))).toBe("post"); // 16:00
    expect(usSession(nov(24, 0, 59))).toBe("post"); // 19:59
    expect(usSession(nov(24, 1, 0))).toBe("overnight"); // 20:00
  });

  it("opens the overnight session on Sunday evening and shuts it on Friday morning", () => {
    expect(usSession(nov(23, 0, 59))).toBe("closed"); // Sunday 19:59
    expect(usSession(nov(23, 1, 0))).toBe("overnight"); // Sunday 20:00
    expect(usSession(nov(27, 8, 59))).toBe("overnight"); // Friday 03:59
    expect(usSession(nov(27, 9, 0))).toBe("pre"); // Friday 04:00
    expect(usSession(nov(28, 0, 59))).toBe("post"); // Friday 19:59
    expect(usSession(nov(28, 1, 0))).toBe("closed"); // Friday 20:00: no session into Saturday
  });

  it("is closed through the weekend", () => {
    expect(usSession(nov(28, 7, 0))).toBe("closed"); // Saturday 02:00
    expect(usSession(nov(28, 17, 0))).toBe("closed"); // Saturday noon
    expect(usSession(nov(22, 7, 0))).toBe("closed"); // Sunday 02:00
    expect(usSession(nov(22, 17, 0))).toBe("closed"); // Sunday noon
  });

  it("follows daylight saving", () => {
    // New York is UTC-4 in July: Tue 14 Jul 2026.
    const jul = (day: number, h: number, m = 0) => Date.UTC(2026, 6, day, h, m);
    expect(usSession(jul(14, 7, 59))).toBe("overnight"); // 03:59
    expect(usSession(jul(14, 8, 0))).toBe("pre"); // 04:00
    expect(usSession(jul(14, 13, 30))).toBe("regular"); // 09:30
    expect(usSession(jul(14, 23, 59))).toBe("post"); // 19:59
    expect(usSession(jul(15, 0, 0))).toBe("overnight"); // 20:00
  });
});
