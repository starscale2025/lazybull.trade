// Draws the film's corridor plates: public/cinema/plates/*.svg.
//
// These used to be screenshots of the app (public/cinema/shots/*.webp), baked
// by capture.mjs. Screenshots go stale silently: by 2026-11 the dive was still
// flying past a "BET BUILDER · V2" header, an AMZN forecast cone and a thesis
// line that the product had removed months earlier, and nothing in
// `npm run verify` could notice. A plate drawn from code cannot advertise a
// screen that no longer ships, and the compliance lint reads it like any other
// source file (".svg" is in its SCAN_EXT).
//
// Every number on a plate is illustrative and says so. Deterministic: the same
// script always writes the same bytes.
//
//   node scripts/cinema/plates.mjs        (or: npm run cinema:plates)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../public/cinema/plates");
const W = 1280;
const H = 800;
const C = {
  bg: "#070908",
  panel: "#0c1210",
  line: "#1d2420",
  faint: "#3a403c",
  gray: "#8a8a82",
  ink: "#f5f5f0",
  bull: "#00ff87",
  bear: "#ff2e63",
  cyan: "#00e5ff",
  amber: "#ffb800",
};
const MONO = "JetBrains Mono, ui-monospace, Menlo, monospace";

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n) => n.toFixed(1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, s, { size = 14, fill = C.gray, anchor = "start", weight = 500, ls = 0 } = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(s)}</text>`;
const rect = (x, y, w, h, { fill = C.panel, stroke = C.line, r = 6, sw = 1 } = {}) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x1, y1, x2, y2, { stroke = C.line, sw = 1, dash = "" } = {}) =>
  `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const poly = (pts, { stroke = C.bull, sw = 2.5, fill = "none" } = {}) =>
  `<polyline points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;

/** The window every plate sits in: a title bar naming the room, and the SIM lamp. */
function frame(room, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="0" y="0" width="${W}" height="52" fill="${C.panel}"/>
${line(0, 52, W, 52)}
<circle cx="28" cy="26" r="6" fill="${C.faint}"/><circle cx="48" cy="26" r="6" fill="${C.faint}"/><circle cx="68" cy="26" r="6" fill="${C.faint}"/>
${text(96, 31, `lazybull · ${room}`, { size: 15, fill: C.ink, weight: 600, ls: 1 })}
<circle cx="${W - 300}" cy="26" r="4" fill="${C.amber}"/>
${text(W - 28, 31, "SIM · ILLUSTRATIVE · PAPER-ONLY", { size: 12, fill: C.amber, ls: 1, anchor: "end" })}
${body}
</svg>
`;
}

/**
 * A payoff chart in a box: green above zero, red below, split by clip paths so
 * a loss is never painted as a gain. `fn` maps price → P&L.
 */
function payoff(id, x, y, w, h, { lo, hi, fn, pmin, pmax, strikes = [], labels = true }) {
  const N = 120;
  const px = (p) => x + ((p - lo) / (hi - lo)) * w;
  const py = (v) => y + h * (1 - (v - pmin) / (pmax - pmin));
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const p = lo + ((hi - lo) * i) / N;
    pts.push([px(p), py(fn(p))]);
  }
  const zy = py(0);
  const area = `M${f1(pts[0][0])},${f1(zy)} ` + pts.map(([a, b]) => `L${f1(a)},${f1(b)}`).join(" ") + ` L${f1(pts[N][0])},${f1(zy)} Z`;
  const out = [];
  out.push(`<defs><clipPath id="${id}-up"><rect x="${x}" y="${y - 6}" width="${w}" height="${f1(zy - y + 6)}"/></clipPath>`);
  out.push(`<clipPath id="${id}-dn"><rect x="${x}" y="${f1(zy)}" width="${w}" height="${f1(y + h - zy + 6)}"/></clipPath></defs>`);
  out.push(`<path d="${area}" fill="${C.bull}" fill-opacity="0.12" clip-path="url(#${id}-up)"/>`);
  out.push(`<path d="${area}" fill="${C.bear}" fill-opacity="0.16" clip-path="url(#${id}-dn)"/>`);
  out.push(line(x, zy, x + w, zy, { stroke: C.gray, sw: 1, dash: "5 6" }));
  if (labels) out.push(text(x - 10, zy + 5, "$0", { size: 13, anchor: "end" }));
  for (const k of strikes) {
    out.push(line(px(k), y, px(k), y + h, { stroke: C.faint, dash: "3 6" }));
    if (labels) out.push(text(px(k), y + h + 22, `K ${k}`, { size: 13, anchor: "middle" }));
  }
  out.push(`<g clip-path="url(#${id}-up)">${poly(pts, { stroke: C.bull, sw: 3 })}</g>`);
  out.push(`<g clip-path="url(#${id}-dn)">${poly(pts, { stroke: C.bear, sw: 3 })}</g>`);
  return { svg: out.join("\n"), px, py };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// bull call spread, 100/108, debit 2.30 → per contract ×100
const spread = (p) => (clamp(p - 100, 0, 8) - 2.3) * 100;
// iron condor 92/96/104/108, credit 1.40
const condor = (p) => (1.4 - clamp(96 - p, 0, 4) - clamp(p - 104, 0, 4)) * 100;
// long call 100, premium 3.10
const longCall = (p) => (Math.max(0, p - 100) - 3.1) * 100;

const plates = {};

// ── strategy builder ───────────────────────────────────────────────────────
plates.trade = () => {
  const ch = payoff("tr", 110, 150, 760, 470, { lo: 86, hi: 116, fn: spread, pmin: -420, pmax: 760, strikes: [100, 108] });
  const handles = [100, 108]
    .map((k) => `<circle cx="${f1(ch.px(k))}" cy="${f1(ch.py(spread(k)))}" r="9" fill="${C.bg}" stroke="${C.ink}" stroke-width="2.5"/>`)
    .join("");
  const side = [
    rect(920, 110, 320, 640),
    text(944, 150, "LEGS", { size: 12, ls: 2 }),
    text(944, 184, "long  1 × C 100", { size: 16, fill: C.ink }),
    text(944, 214, "short 1 × C 108", { size: 16, fill: C.ink }),
    line(944, 240, 1216, 240),
    text(944, 276, "MOST IT CAN LOSE", { size: 12, ls: 2 }),
    text(944, 314, "−$230", { size: 34, fill: C.bear, weight: 700 }),
    text(944, 364, "MOST IT CAN MAKE", { size: 12, ls: 2 }),
    text(944, 402, "+$570", { size: 34, fill: C.ink, weight: 700 }),
    text(944, 428, "only above 108 at expiry", { size: 12 }),
    line(944, 456, 1216, 456),
    text(944, 492, "BREAKEVEN", { size: 12, ls: 2 }),
    text(944, 524, "$102.30", { size: 22, fill: C.cyan, weight: 600 }),
    line(944, 556, 1216, 556),
    text(944, 592, "defined risk · chosen before", { size: 13, fill: C.bull }),
    text(944, 614, "the trade, not found after it", { size: 13, fill: C.bull }),
  ].join("\n");
  return frame("strategy builder", [
    text(110, 104, "BULL CALL SPREAD · SIM · 30 DAYS", { size: 13, ls: 2 }),
    ch.svg,
    handles,
    text(110, 700, "drag a strike: the curve, max loss and breakeven redraw", { size: 14 }),
    side,
  ].join("\n"));
};

// ── options chain ──────────────────────────────────────────────────────────
plates.chain = () => {
  const rows = [];
  const cols = [
    [90, "Δ"], [190, "BID"], [290, "ASK"], [470, "STRIKE"], [650, "BID"], [750, "ASK"], [850, "Δ"], [990, "IV"],
  ];
  rows.push(rect(60, 96, 1160, 660));
  rows.push(text(90, 130, "CALLS", { size: 12, fill: C.bull, ls: 2 }));
  rows.push(text(650, 130, "PUTS", { size: 12, fill: C.bear, ls: 2 }));
  rows.push(text(1190, 130, "SIM · 30 DTE", { size: 12, anchor: "end", ls: 1 }));
  for (const [x, h] of cols) rows.push(text(x, 166, h, { size: 12, ls: 2, anchor: h === "STRIKE" ? "middle" : "start" }));
  rows.push(line(80, 182, 1200, 182));
  const N = 13;
  for (let i = 0; i < N; i++) {
    const k = 88 + i * 2;
    const y = 214 + i * 40;
    const m = (100 - k) / 10;
    const cd = clamp(0.5 + m * 0.42, 0.03, 0.97);
    const cp = Math.max(0.05, (100 - k) + 2.6 * Math.exp(-((k - 100) ** 2) / 120));
    const pp = Math.max(0.05, (k - 100) + 2.6 * Math.exp(-((k - 100) ** 2) / 120));
    const iv = 22 + Math.abs(k - 100) * 0.35;
    if (k === 100) rows.push(rect(70, y - 26, 1140, 38, { fill: "#0f1f18", stroke: C.bull, r: 4 }));
    const cell = (x, s, fill = C.ink, anchor = "start") => rows.push(text(x, y, s, { size: 16, fill, anchor }));
    cell(90, cd.toFixed(2), C.gray);
    cell(190, Math.max(0.01, cp - 0.05).toFixed(2));
    cell(290, (cp + 0.05).toFixed(2));
    cell(470, String(k), k === 100 ? C.bull : C.ink, "middle");
    cell(650, Math.max(0.01, pp - 0.05).toFixed(2));
    cell(750, (pp + 0.05).toFixed(2));
    cell(850, (cd - 1).toFixed(2), C.gray);
    cell(990, `${iv.toFixed(1)}%`, C.gray);
  }
  rows.push(text(470, 744, "ATM · spot 100.00", { size: 12, fill: C.bull, anchor: "middle", ls: 1 }));
  return frame("options chain", rows.join("\n"));
};

// ── learn ──────────────────────────────────────────────────────────────────
plates.learn = () => {
  const chapters = [
    "Regime", "Primitives", "Live demo", "Backtest", "Consensus", "Greeks", "Vol smile",
    "Probability", "Families", "Dataset", "Teacher", "BYO bot", "AI quants", "Now go",
  ];
  const nav = [rect(40, 84, 260, 676)];
  chapters.forEach((c, i) => {
    const y = 128 + i * 44;
    const on = i === 5;
    if (on) nav.push(rect(52, y - 26, 236, 38, { fill: "#0f1f18", stroke: C.bull, r: 4 }));
    nav.push(text(70, y, String(i + 1).padStart(2, "0"), { size: 13, fill: on ? C.bull : C.faint }));
    nav.push(text(110, y, c, { size: 15, fill: on ? C.ink : C.gray }));
  });
  const ch = payoff("le", 400, 300, 700, 300, { lo: 86, hi: 116, fn: longCall, pmin: -500, pmax: 1400, strikes: [100] });
  const slider = [
    line(400, 690, 1100, 690, { stroke: C.faint, sw: 4 }),
    line(400, 690, 790, 690, { stroke: C.bull, sw: 4 }),
    `<circle cx="790" cy="690" r="11" fill="${C.ink}"/>`,
    text(400, 728, "drag the price: watch delta move", { size: 13 }),
  ].join("\n");
  return frame("learn · chapter 06", [
    nav.join("\n"),
    text(360, 140, "CHAPTER 06 · GREEKS", { size: 13, fill: C.bull, ls: 2 }),
    text(360, 196, "Delta is a slope,", { size: 40, fill: C.ink, weight: 700 }),
    text(360, 244, "not a promise.", { size: 40, fill: C.gray, weight: 700 }),
    ch.svg,
    slider,
  ].join("\n"));
};

// ── quant workbench ────────────────────────────────────────────────────────
plates.quant = () => {
  const models = [
    ["SMA Crossover", 0.42], ["RSI Reversion", -0.31], ["Kalman Filter", 0.18],
    ["Bollinger Bands", -0.22], ["Z-Score Reversion", 0.27], ["Hurst Exponent", -0.12],
  ];
  const cx = 760;
  const out = [rect(60, 96, 1160, 400)];
  out.push(text(90, 136, "6 MODELS REPLAYED · SAME TAPE · WALK-FORWARD", { size: 12, ls: 2 }));
  out.push(line(cx, 160, cx, 470, { stroke: C.faint }));
  out.push(text(cx - 12, 176, "← leaned down", { size: 11, anchor: "end" }));
  out.push(text(cx + 12, 176, "leaned up →", { size: 11 }));
  models.forEach(([n, v], i) => {
    const y = 214 + i * 44;
    out.push(text(90, y + 6, n, { size: 16, fill: C.ink }));
    const w = Math.abs(v) * 900;
    const col = v > 0 ? C.bull : C.bear;
    out.push(`<rect x="${f1(v > 0 ? cx : cx - w)}" y="${y - 10}" width="${f1(w)}" height="20" rx="3" fill="${col}" fill-opacity="0.55"/>`);
  });
  out.push(text(90, 530, "3 agreed, 3 did not: a split, not a call", { size: 18, fill: C.ink, weight: 600 }));
  // a hypothetical equity curve
  out.push(rect(60, 560, 1160, 196));
  out.push(text(90, 594, "BACKTEST · HYPOTHETICAL · NOT A FORECAST", { size: 12, ls: 2 }));
  const r = rng(7);
  let v = 0;
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    v += (r() - 0.48) * 9;
    pts.push([90 + i * 11, 690 - v]);
  }
  out.push(line(90, 690, 1190, 690, { stroke: C.faint, dash: "4 6" }));
  out.push(poly(pts, { stroke: C.cyan, sw: 2 }));
  return frame("quant workbench", out.join("\n"));
};

// ── pro charts ─────────────────────────────────────────────────────────────
plates.pro = () => {
  const r = rng(42);
  const N = 64;
  const x0 = 80, x1 = 1140, top = 110, bot = 560;
  const bars = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    const o = p;
    p += (r() - 0.5) * 2.6 + Math.sin(i / 9) * 0.35;
    const c = p;
    const h = Math.max(o, c) + r() * 1.2;
    const l = Math.min(o, c) - r() * 1.2;
    bars.push({ o, c, h, l, v: 0.3 + r() * 0.7 });
  }
  const lo = Math.min(...bars.map((b) => b.l)) - 1;
  const hi = Math.max(...bars.map((b) => b.h)) + 1;
  const y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const step = (x1 - x0) / N;
  const out = [rect(60, 84, 1100, 676)];
  for (let g = 0; g < 5; g++) out.push(line(x0, top + g * 112, x1, top + g * 112, { stroke: C.line }));
  bars.forEach((b, i) => {
    const cx = x0 + step * (i + 0.5);
    const col = b.c >= b.o ? C.bull : C.bear;
    out.push(line(cx, y(b.h), cx, y(b.l), { stroke: col, sw: 1.4 }));
    out.push(`<rect x="${f1(cx - step * 0.32)}" y="${f1(y(Math.max(b.o, b.c)))}" width="${f1(step * 0.64)}" height="${f1(Math.max(1.5, Math.abs(y(b.o) - y(b.c))))}" fill="${col}"/>`);
    out.push(`<rect x="${f1(cx - step * 0.32)}" y="${f1(740 - b.v * 140)}" width="${f1(step * 0.64)}" height="${f1(b.v * 140)}" fill="${col}" fill-opacity="0.25"/>`);
  });
  // EMA
  let e = bars[0].c;
  const k = 2 / 13;
  const ema = bars.map((b, i) => {
    e = b.c * k + e * (1 - k);
    return [x0 + step * (i + 0.5), y(e)];
  });
  out.push(poly(ema, { stroke: C.amber, sw: 2 }));
  out.push(text(84, 108, "SIM · 1D · EMA 12", { size: 12, fill: C.amber, ls: 2 }));
  // toolbar
  out.push(rect(1176, 84, 64, 676));
  for (let t = 0; t < 10; t++) out.push(rect(1192, 104 + t * 56, 32, 32, { fill: C.bg, stroke: C.faint, r: 4 }));
  return frame("pro charts · delayed", out.join("\n"));
};

// ── bots ───────────────────────────────────────────────────────────────────
plates.bots = () => {
  const names = [
    "SMA Crossover", "RSI Reversion", "MACD Histogram", "Donchian Breakout", "Bollinger Bands",
    "Z-Score Reversion", "Hurst Exponent", "Kalman Filter", "LinReg Channel",
  ];
  const out = [];
  names.forEach((n, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 60 + col * 392, y = 92 + row * 228;
    out.push(rect(x, y, 368, 208));
    out.push(text(x + 22, y + 40, n, { size: 18, fill: C.ink, weight: 600 }));
    out.push(text(x + 22, y + 66, "teaching bot · hypothetical", { size: 12 }));
    const r = rng(100 + i);
    let v = 0;
    const pts = [];
    for (let j = 0; j <= 40; j++) {
      v += (r() - 0.5) * 7;
      pts.push([x + 22 + j * 8, y + 140 - v]);
    }
    out.push(line(x + 22, y + 140, x + 346, y + 140, { stroke: C.faint, dash: "3 5" }));
    out.push(poly(pts, { stroke: i % 2 ? C.cyan : C.gray, sw: 2 }));
    out.push(text(x + 22, y + 192, "open the math →", { size: 12, fill: C.bull }));
  });
  return frame("27 teaching bots", out.join("\n"));
};

// ── about ──────────────────────────────────────────────────────────────────
plates.about = () => {
  const ch = payoff("ab", 140, 470, 1000, 220, { lo: 86, hi: 114, fn: condor, pmin: -320, pmax: 220, strikes: [96, 104], labels: false });
  return frame("about", [
    text(140, 250, "lazybull", { size: 120, fill: C.ink, weight: 700, ls: -4 }),
    text(146, 320, "options you can see", { size: 26, fill: C.bull }),
    text(146, 372, "paper-only · $0 real money, ever · education, not advice", { size: 16 }),
    ch.svg,
  ].join("\n"));
};

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of Object.entries(plates)) {
  const svg = draw();
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(`plates: ${name}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
