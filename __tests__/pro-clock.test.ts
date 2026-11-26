// The Pro terminal's clock is India time, for every viewer.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fmtIST } from "@/lib/pro/clock";

afterEach(() => vi.restoreAllMocks());

/** 10:12:27 UTC on 25 November 2026, which is 15:42:27 in India. */
const AT = new Date(Date.UTC(2026, 10, 25, 10, 12, 27));

describe("fmtIST", () => {
  it("adds five and a half hours to UTC", () => {
    expect(fmtIST(AT)).toBe("15:42:27");
  });

  it("REGRESSION: reads the same wherever the viewer is", () => {
    // It once subtracted the viewer's own offset as well: in India (−330) the
    // clock ran 5.5 hours fast, 21:12 for 15:42; in New York (+300) 5 slow.
    for (const viewerOffset of [-330, 300, 0, -60, 480]) {
      vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(viewerOffset);
      expect(fmtIST(AT), `viewer offset ${viewerOffset}`).toBe("15:42:27");
    }
  });

  it("rolls over midnight, and pads", () => {
    expect(fmtIST(new Date(Date.UTC(2026, 10, 25, 18, 30, 0)))).toBe("00:00:00");
    expect(fmtIST(new Date(Date.UTC(2026, 10, 25, 19, 5, 9)))).toBe("00:35:09");
  });
});
