import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RAMP_GROUND, RAMP_STOPS, rampSteps, type VizTheme } from "@/lib/viz/ramp";
import { contrast, deltaE, lightness } from "@/lib/viz/color";
import { niceDomain, niceTicks, tickLabel } from "@/lib/viz/scale";
import { TAPE, tapeBars, tapeSpot } from "@/lib/viz/tape";
import { GREEKS_PROJECTOR, surfaceQuads } from "@/lib/viz/surface";
import {
  CashLadderFigure,
  CurveFigure,
  DepthLadderFigure,
  FoldStripsFigure,
  HistogramFigure,
  IterationFigure,
  LatticeFigure,
  MatrixFigure,
  SeriesFigure,
  SurfaceFigure,
} from "@/components/viz";

// The figure kit's colour rules, as a build gate (plan A5, Stage 3): a token
// change that flattens the ramp, drifts from the maths, or makes the model's
// blue hard to tell from its grey reference fails here.

const css = readFileSync("app/globals.css", "utf8");
const cssRamp = (theme: VizTheme) => {
  const all = [...css.matchAll(/--viz-ramp-(\d): (#[0-9A-F]{6})/g)].map((m) => m[2]);
  return theme === "dark" ? all.slice(0, 9) : all.slice(9, 18);
};

describe("the brand ramp", () => {
  for (const theme of ["dark", "light"] as const) {
    const steps = rampSteps(theme);
    it(`${theme}: the CSS tokens are the ramp's own steps`, () => {
      expect(cssRamp(theme)).toEqual(steps);
    });
    it(`${theme}: lightness moves one way, in even steps`, () => {
      const L = steps.map(lightness);
      const d = L.slice(1).map((l, i) => l - L[i]);
      const dir = theme === "dark" ? 1 : -1;
      for (const x of d) expect(x * dir).toBeGreaterThan(0.02);
      expect(Math.max(...d.map(Math.abs)) / Math.min(...d.map(Math.abs))).toBeLessThan(1.8);
    });
    it(`${theme}: the highest value stands out most from the page`, () => {
      const c = steps.map((s) => contrast(s, RAMP_GROUND[theme]));
      expect(c[8]).toBeGreaterThan(c[0]);
      expect(c[0]).toBeGreaterThan(theme === "dark" ? 3.8 : 2.2); // the faint end still reads
      expect(c[8]).toBeGreaterThan(6);
    });
  }
  it("starts and ends on the published stops", () => {
    expect(rampSteps("dark")[0]).toBe(RAMP_STOPS.dark[0]);
    expect(rampSteps("light")[8]).toBe(RAMP_STOPS.light[2]);
  });
});

describe("the line colours", () => {
  it("a model's blue is easy to tell from its grey reference, in both themes", () => {
    const pick = (name: string, block: number) => [...css.matchAll(new RegExp(`--viz-${name}: (#[0-9A-F]{6})`, "g"))][block][1];
    for (const block of [0, 1]) expect(deltaE(pick("model", block), pick("ref", block))).toBeGreaterThan(15);
  });
});

describe("scales and ticks", () => {
  it("lands on nice steps and keeps zero", () => {
    expect(niceTicks(-0.13, 0, 5)).toEqual([-0.1, -0.05, 0]);
    expect(niceTicks(-0.13, 0, 6)).toEqual([-0.125, -0.1, -0.075, -0.05, -0.025, 0]);
    expect(Object.is(niceTicks(-1, 0, 2).at(-1), 0)).toBe(true); // +0, never -0
    expect(niceDomain(3, 97, 4, true)).toEqual([0, 100]);
    expect(niceDomain(-0.13, -0.01, 4, true)[1]).toBe(0);
  });
  it("writes a real minus sign", () => {
    expect(tickLabel(-0.05, 0.025)).toBe("−0.050");
    expect(tickLabel(-1e-12, 0.5)).toBe("0.0");
  });
});

describe("one tape", () => {
  it("every symbol's walk ends on its quoted spot, the same every call", () => {
    for (const s of TAPE) {
      const bars = tapeBars(s.sym);
      expect(bars[bars.length - 1].c).toBeCloseTo(s.spot, 6);
      expect(tapeBars(s.sym)).toEqual(bars);
    }
    expect(tapeSpot("AMZN")).toBe(226.45);
  });
});

describe("the surface projector", () => {
  it("paints back to front, one quad per cell", () => {
    const z = [
      [0, 1, 0],
      [0, 2, 0],
      [0, 3, 0],
    ];
    const q = surfaceQuads(z, 0, 3, GREEKS_PROJECTOR);
    expect(q).toHaveLength(4);
    expect(q[0].t).toBeGreaterThan(q[3].t); // the back row (taller) comes first
  });
});

// Snapshots: every template, rendered on the server as it ships.
describe("the nine templates", () => {
  const curve = Array.from({ length: 21 }, (_, i) => [80 + i * 2, Math.max(0, 80 + i * 2 - 100) - 4] as [number, number]);
  const cases: [string, ReturnType<typeof h>][] = [
    ["curve", h(CurveFigure, { title: "Long call payoff", desc: "Loss of 4 below 100, rising one for one above it.", x: { domain: [80, 120], label: "Price at expiry" }, lines: [{ points: curve, role: "pnl", label: "payoff" }], verticals: [{ x: 104, label: "breakeven" }], markers: [{ x: 110, y: 6, text: "+6.00" }] })],
    ["series", h(SeriesFigure, { title: "Bollinger bands", desc: "AMZN closes with a 20-day band.", values: tapeBars("AMZN", 40).map((b) => b.c), overlays: [{ values: tapeBars("AMZN", 40).map((b, i) => (i < 5 ? null : b.c * 0.99)), role: "model", label: "mean" }], yLabel: "Price" })],
    ["histogram", h(HistogramFigure, { title: "Monte Carlo VaR", desc: "Simulated one-day returns; the worst 5% shaded.", bins: Array.from({ length: 10 }, (_, i) => ({ x0: -5 + i, x1: -4 + i, count: [1, 3, 7, 14, 20, 18, 12, 6, 3, 1][i] })), tail: { below: -3, role: "loss", label: "worst 5%" }, xLabel: "Return %" })],
    ["lattice", h(LatticeFigure, { title: "Binomial American put", desc: "Three steps; early exercise at the lowest nodes.", steps: 3, lit: [[2, 0], [3, 0]] })],
    ["folds", h(FoldStripsFigure, { title: "Purged k-fold", desc: "Three folds with purge and embargo.", length: 30, folds: [0, 1, 2].map((k) => ({ label: `fold ${k + 1}`, segments: [{ from: 0, to: k * 10, kind: "train" as const }, { from: k * 10, to: k * 10 + 8, kind: "test" as const }, { from: k * 10 + 8, to: k * 10 + 10, kind: "embargo" as const }, { from: k * 10 + 10, to: 30, kind: "train" as const }] })) })],
    ["ladder", h(CashLadderFigure, { title: "Bond cash flows", desc: "Pay 95 now, five coupons of 5, 100 back at the end.", flows: [{ t: 0, amount: -95 }, ...[1, 2, 3, 4].map((t) => ({ t, amount: 5 })), { t: 5, amount: 105 }] })],
    ["iteration", h(IterationFigure, { title: "Implied vol by bisection", desc: "Each step halves the bracket.", steps: [{ lo: 0.05, hi: 1, x: 0.525 }, { lo: 0.05, hi: 0.525, x: 0.2875 }, { lo: 0.2875, hi: 0.525, x: 0.40625 }], answer: 0.32, xLabel: "Volatility" })],
    ["matrix", h(MatrixFigure, { title: "Correlation", desc: "Three assets.", rows: ["A", "B", "C"], cols: ["A", "B", "C"], values: [[1, 0.6, 0.2], [0.6, 1, 0.4], [0.2, 0.4, 1]], domain: [0, 1], showValues: true })],
    ["depth", h(DepthLadderFigure, { title: "Order book", desc: "Three levels each side.", levels: [{ price: 100.03, ask: 400 }, { price: 100.02, ask: 900 }, { price: 100.01, ask: 300 }, { price: 99.99, bid: 500 }, { price: 99.98, bid: 800 }, { price: 99.97, bid: 200 }], micro: 99.996 })],
    ["surface", h(SurfaceFigure, { title: "Gamma surface", desc: "A ridge at the money.", z: [[0, 1, 0], [0, 2, 0], [0, 3, 0]], lo: 0, hi: 3, legend: { lo: "0", hi: "3", label: "Gamma" } })],
  ];
  for (const [name, el] of cases) {
    it(`${name}: renders on the server, labelled, and never stretched`, () => {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('role="img"');
      expect(html).toContain("<title");
      expect(html).not.toContain('preserveAspectRatio="none"');
      expect(html).toMatchSnapshot();
    });
  }
});
