// Pure helpers — no React, no DOM. The chart and the drawings share these
// coordinate transforms so a drawing always sits on the price/bar it was
// anchored to, even after scroll/zoom.

export type Bar = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };

export type Viewport = {
  start: number; // first visible bar index (float ok)
  span: number; // number of visible bars
  yMin: number;
  yMax: number;
};

export type ChartGeom = {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
};

export const innerW = (g: ChartGeom) => g.width - g.padL - g.padR;
export const innerH = (g: ChartGeom) => g.height - g.padT - g.padB;

export function xOfBar(i: number, vp: Viewport, g: ChartGeom) {
  const w = innerW(g);
  const slot = w / vp.span;
  return g.padL + (i - vp.start) * slot + slot / 2;
}

export function barOfX(x: number, vp: Viewport, g: ChartGeom) {
  const w = innerW(g);
  const slot = w / vp.span;
  return vp.start + (x - g.padL - slot / 2) / slot;
}

export function yOfPrice(p: number, vp: Viewport, g: ChartGeom) {
  const h = innerH(g);
  return g.padT + ((vp.yMax - p) / (vp.yMax - vp.yMin)) * h;
}

export function priceOfY(y: number, vp: Viewport, g: ChartGeom) {
  const h = innerH(g);
  return vp.yMax - ((y - g.padT) / h) * (vp.yMax - vp.yMin);
}

// Auto-scale Y to visible bars
export function autoY(bars: Bar[], start: number, span: number) {
  const lo = Math.max(0, Math.floor(start));
  const hi = Math.min(bars.length - 1, Math.ceil(start + span));
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (bars[i].h > yMax) yMax = bars[i].h;
    if (bars[i].l < yMin) yMin = bars[i].l;
  }
  const pad = (yMax - yMin) * 0.08;
  return { yMin: yMin - pad, yMax: yMax + pad };
}

// Deterministic seeded RNG (mulberry32)
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genBars({
  seed = 7,
  count = 600,
  start = 22000,
  drift = 0.04,
  vol = 220,
  startTime = Date.now() - 600 * 86_400_000,
  stepMs = 7 * 86_400_000,
}: {
  seed?: number;
  count?: number;
  start?: number;
  drift?: number;
  vol?: number;
  startTime?: number;
  stepMs?: number;
} = {}): Bar[] {
  const rand = mulberry32(seed);
  const out: Bar[] = [];
  let last = start;
  for (let i = 0; i < count; i++) {
    const o = last;
    const trend = drift + Math.sin(i / 22) * 0.06 + Math.sin(i / 73) * 0.04;
    const c = Math.max(1, o + (rand() - 0.5 + trend) * vol);
    const h = Math.max(o, c) + rand() * vol * 0.6;
    const l = Math.min(o, c) - rand() * vol * 0.6;
    const v = Math.round(80_000_000 + rand() * 240_000_000);
    out.push({ i, t: startTime + i * stepMs, o, h, l: Math.max(1, l), c, v });
    last = c;
  }
  return out;
}

export type Drawing =
  | { id: string; tool: "trendline"; a: { i: number; p: number }; b: { i: number; p: number }; color: string }
  | { id: string; tool: "horizontal"; p: number; color: string }
  | { id: string; tool: "ray"; a: { i: number; p: number }; b: { i: number; p: number }; color: string }
  | { id: string; tool: "rect"; a: { i: number; p: number }; b: { i: number; p: number }; color: string }
  | { id: string; tool: "fib"; a: { i: number; p: number }; b: { i: number; p: number } }
  | { id: string; tool: "channel"; a: { i: number; p: number }; b: { i: number; p: number }; offset: number; color: string }
  | { id: string; tool: "text"; a: { i: number; p: number }; text: string; color: string }
  | { id: string; tool: "brush"; pts: { i: number; p: number }[]; color: string }
  | { id: string; tool: "measure"; a: { i: number; p: number }; b: { i: number; p: number } }
  | { id: string; tool: "callout"; a: { i: number; p: number }; text: string; color: string };

export type ToolKind =
  | "cursor"
  | "trendline"
  | "horizontal"
  | "ray"
  | "rect"
  | "fib"
  | "channel"
  | "text"
  | "brush"
  | "measure"
  | "callout"
  | "eraser";

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];
export const FIB_COLORS = [
  "#9aa0a6", // 0
  "#ff2e63", // 0.236
  "#ffb800", // 0.382
  "#22c55e", // 0.5
  "#22d3ee", // 0.618
  "#06b6d4", // 0.786
  "#9aa0a6", // 1
  "#a78bfa", // 1.272
  "#00ff87", // 1.618
];

// Format number with thousand separators + n decimals
export function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" });
}

// Distance from a point to a line segment, in screen pixels
export function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
