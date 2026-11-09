import { describe, expect, it } from "vitest";
import { DEFAULT_SAVED, DEFAULT_SLOTS, MAX_SLOTS, activeSlot, cleanSaved, cleanSlots, slotsFor, withSlots, withoutPage } from "@/lib/shortcuts";

describe("the visitor's shortcuts", () => {
  it("never trusts what was saved", () => {
    expect(cleanSlots(["builder", "nope", "builder", 7, "pro"])).toEqual(["builder", "pro"]);
    expect(cleanSlots("builder")).toEqual([]);
    expect(cleanSlots(["home", "builder", "chain", "pro", "portfolio", "learn", "practice", "greeks"])).toHaveLength(MAX_SLOTS);
    expect(cleanSaved(null).all).toEqual([...DEFAULT_SLOTS]);
    expect(cleanSaved({ all: ["bad"], pages: { "/x": ["bad"], "/y": ["pro"] } })).toEqual({ all: [...DEFAULT_SLOTS], pages: { "/y": ["pro"] } });
  });

  it("uses a page's own set where there is one, the shared set elsewhere", () => {
    const s = withSlots(DEFAULT_SAVED, "/learn", true, ["greeks", "practice"]);
    expect(slotsFor(s, "/learn")).toEqual({ ids: ["greeks", "practice"], own: true });
    expect(slotsFor(s, "/trade")).toEqual({ ids: [...DEFAULT_SLOTS], own: false });
    expect(slotsFor(withoutPage(s, "/learn"), "/learn").own).toBe(false);
  });

  it("changes the every-page set without touching a page's own", () => {
    const s = withSlots(withSlots(DEFAULT_SAVED, "/learn", true, ["greeks"]), "/learn", false, ["pro"]);
    expect(s.all).toEqual(["pro"]);
    expect(s.pages["/learn"]).toEqual(["greeks"]);
  });

  it("always keeps at least one shortcut", () => {
    expect(withSlots(DEFAULT_SAVED, "/", false, [])).toBe(DEFAULT_SAVED);
  });

  it("lights the page you are on, the most specific match winning", () => {
    const ids = ["builder", "chain", "home", "search"];
    expect(activeSlot(ids, "/trade/chain")).toBe(1);
    expect(activeSlot(ids, "/trade")).toBe(0);
    expect(activeSlot(ids, "/")).toBe(2);
    expect(activeSlot(ids, "/learn")).toBe(-1);
    expect(activeSlot(["builder"], "/tradeoff")).toBe(-1);
  });
});
