import { describe, expect, it } from "vitest";
import { splitLayers } from "@/components/atmosphere/MaterialHero";

describe("splitLayers", () => {
  it("splits lines into behind/front by the marker index", () => {
    const r = splitLayers(["THE", "TIMELESS", "AUTOMATIC", "WATCH"], 2);
    expect(r.behind).toEqual(["THE", "TIMELESS"]);
    expect(r.front).toEqual(["AUTOMATIC", "WATCH"]);
  });
  it("clamps out-of-range markers", () => {
    expect(splitLayers(["A", "B"], 99).front).toEqual([]);
    expect(splitLayers(["A", "B"], 0).behind).toEqual([]);
  });
});
