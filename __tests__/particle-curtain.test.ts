import { describe, expect, it } from "vitest";
import { buildColumns } from "@/components/atmosphere/ParticleCurtain";

describe("buildColumns", () => {
  it("is deterministic for a given seed", () => {
    const a = buildColumns(12, 7);
    const b = buildColumns(12, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
  });
  it("keeps phase and speed in sane ranges", () => {
    for (const c of buildColumns(40, 3)) {
      expect(c.phase).toBeGreaterThanOrEqual(0);
      expect(c.phase).toBeLessThan(1);
      expect(c.speed).toBeGreaterThan(0.2);
      expect(c.speed).toBeLessThan(1.61);
    }
  });
});
