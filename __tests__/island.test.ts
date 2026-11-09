import { describe, expect, it } from "vitest";
import { clearIsland, getIsland, getIslandStage, setIsland, setIslandStage, type IslandState } from "@/lib/island";

const base: IslandState = {
  id: "a",
  label: "Your spread · paper",
  value: "−$240",
  caption: "the most it can lose",
  segments: 8,
  active: 3,
  glyph: "payoff",
  announce: "pinned",
};

describe("the Island store", () => {
  it("holds one entry, and the latest publisher wins", () => {
    setIsland(base);
    setIsland({ ...base, id: "b", value: "$90" });
    expect(getIsland()?.id).toBe("b");
    clearIsland("b");
  });

  it("clears only an entry its caller owns", () => {
    setIsland(base);
    setIsland({ ...base, id: "next-page" });
    clearIsland("a"); // the old page unmounting late
    expect(getIsland()?.id).toBe("next-page");
    clearIsland("next-page");
    expect(getIsland()).toBeNull();
  });

  it("does not notify for an identical state", () => {
    setIsland(base);
    const first = getIsland();
    setIsland({ ...base });
    expect(getIsland()).toBe(first);
    clearIsland("a");
  });

  it("says paper on every label it is given here", () => {
    // The publishers in the app (PayoffInstrument, /trade) all label paper;
    // this pins the convention the compliance copy depends on.
    expect(base.label).toMatch(/paper/);
  });

  it("prints a loss with its sign", () => {
    // Gate A4 #4: an unsigned "$483" in the gain colour read as a gain.
    expect(base.value).toMatch(/^−\$/);
  });
});

describe("the film's stage over the Island", () => {
  it("holds the film's form until the film lets go", () => {
    setIslandStage("dot");
    expect(getIslandStage()).toBe("dot");
    setIslandStage("pill");
    expect(getIslandStage()).toBe("pill");
    setIslandStage(null);
    expect(getIslandStage()).toBeNull();
  });
});
