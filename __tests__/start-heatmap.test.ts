import { describe, expect, it } from "vitest";
import { squarify } from "@/lib/viz/treemap";
import { MAP_SECTORS, MAP_SYMBOLS, inkOn, moveColor, simulatedMoves } from "@/lib/market/heatmap";
import { contrast, lightness } from "@/lib/viz/color";

// The market map on /start (2026-11-20): a squarified treemap of ~100 large
// US stocks by sector, coloured by the day's move.

describe("squarify", () => {
  const rect = { x: 10, y: 20, w: 800, h: 500 };
  const items = [500, 300, 200, 120, 80, 60, 40, 20, 10, 5].map((value, i) => ({ value, data: i }));
  const tiles = squarify(items, rect);

  it("places every item, with area in proportion to its value", () => {
    expect(tiles).toHaveLength(items.length);
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const t of tiles) {
      const want = (items[t.data].value / total) * rect.w * rect.h;
      expect(t.w * t.h).toBeCloseTo(want, 6);
    }
  });

  it("keeps every tile inside the box, with no overlaps", () => {
    const eps = 1e-6;
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(rect.x - eps);
      expect(t.y).toBeGreaterThanOrEqual(rect.y - eps);
      expect(t.x + t.w).toBeLessThanOrEqual(rect.x + rect.w + eps);
      expect(t.y + t.h).toBeLessThanOrEqual(rect.y + rect.h + eps);
    }
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], b = tiles[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > eps && oy > eps, `${i} overlaps ${j}`).toBe(false);
      }
  });

  it("keeps the big tiles close to square", () => {
    const big = tiles.filter((t) => items[t.data].value >= 120);
    for (const t of big) expect(Math.max(t.w / t.h, t.h / t.w)).toBeLessThan(3);
  });

  it("ignores zero, negative and empty input", () => {
    expect(squarify([], rect)).toEqual([]);
    expect(squarify([{ value: 0, data: 1 }, { value: -3, data: 2 }], rect)).toEqual([]);
    expect(squarify([{ value: 1, data: 1 }], { x: 0, y: 0, w: 0, h: 10 })).toEqual([]);
  });
});

describe("the market map's data", () => {
  it("lists each ticker once, every cap positive, in batches the quote API takes", () => {
    expect(new Set(MAP_SYMBOLS).size).toBe(MAP_SYMBOLS.length);
    expect(MAP_SYMBOLS.length).toBeLessThanOrEqual(150); // three /api/quote-batch calls of ≤50
    for (const s of MAP_SECTORS) for (const x of s.stocks) expect(x.cap, x.sym).toBeGreaterThan(0);
  });

  it("colours a move by direction and size, and its label stays readable", () => {
    expect(moveColor(0)).toBe(moveColor(-0));
    expect(moveColor(3)).toBe(moveColor(9)); // full at ±3%
    expect(moveColor(1)).not.toBe(moveColor(-1));
    for (const p of [-5, -2, -0.4, 0, 0.4, 2, 5, null]) {
      const bg = moveColor(p);
      expect(contrast(inkOn(bg), bg), String(p)).toBeGreaterThan(4.5);
    }
  });

  it("keeps the map under the wordmark: a gain and a loss of one size equally light, every tile darker than the word", () => {
    // the wordmark's darkest green (start.module.css, .word)
    const word = lightness("#00a857");
    for (const p of [0.3, 1, 2, 3, 6]) expect(Math.abs(lightness(moveColor(p)) - lightness(moveColor(-p))), String(p)).toBeLessThan(0.02);
    for (const p of [-6, -3, -1, 0, 1, 3, 6, null]) expect(lightness(moveColor(p)), String(p)).toBeLessThan(word - 0.2);
  });

  it("simulates the same day the same way, and a different day differently", () => {
    const a = simulatedMoves("2026-11-20");
    expect(simulatedMoves("2026-11-20")).toEqual(a);
    expect(simulatedMoves("2026-11-21")).not.toEqual(a);
    for (const v of Object.values(a)) expect(Math.abs(v)).toBeLessThan(6);
  });
});
