import type { Bar } from "@/components/pro/chartCore";

/**
 * The math behind "Anatomy of a Broken VWAP" (/learn/broken-vwap) — the
 * lesson that dissects the bug WE shipped. Pure functions, imported by the
 * lesson cell and pinned by __tests__/broken-vwap-lesson.test.ts.
 *
 * The FIXED series in the lesson is not a copy — the cell imports the real
 * `vwap` from components/pro/indicators, the module on screen at /pro.
 */

// Local mulberry32 so the tape is deterministic and this module stays pure.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two intraday sessions of 5-minute bars (78 each, 09:30–16:00 ET), seeded so
 * every visitor sees the same tape. Session 1 rallies hard on heavy morning
 * volume then fades — the shape that makes an anchored VWAP visibly diverge
 * from typical price. Session 2 gaps down, so the honest anchor reset is
 * unmissable.
 */
export function makeLessonTape(): Bar[] {
  const rnd = mulberry32(1337);
  const bars: Bar[] = [];
  const BARS_PER_DAY = 78;
  // Mon Jul 20 2026, 09:30 ET = 13:30 UTC (DST).
  const opens = [Date.UTC(2026, 6, 20, 13, 30), Date.UTC(2026, 6, 21, 13, 30)];
  let i = 0;
  for (let day = 0; day < 2; day++) {
    let px = day === 0 ? 100 : 99.1; // day 2 gaps down
    for (let b = 0; b < BARS_PER_DAY; b++) {
      const t = opens[day] + b * 5 * 60_000;
      const frac = b / BARS_PER_DAY;
      // Day 1: sharp morning rally (+4 by bar ~22) then a slow fade.
      // Day 2: chop, then a modest recovery into the close.
      const drift =
        day === 0
          ? frac < 0.28
            ? 0.185
            : -0.035
          : frac < 0.5
            ? 0.004
            : 0.022;
      const noise = (rnd() - 0.5) * 0.22;
      const o = px;
      const c = px + drift + noise;
      const h = Math.max(o, c) + rnd() * 0.12;
      const l = Math.min(o, c) - rnd() * 0.12;
      // Volume front-loaded into the morning — that weight is WHY anchored
      // VWAP hangs below the afternoon price on day 1.
      const v = Math.round((1 + 3.2 * Math.exp(-4 * frac) + rnd() * 0.4) * 10_000);
      bars.push({ i: i++, t, o, h, l, c, v });
      px = c;
    }
  }
  return bars;
}

/**
 * THE SHIPPED BUG, reproduced verbatim from commit e6900cf (the initial
 * project commit). Do not fix it — this function's job is to be wrong the
 * exact way production was wrong.
 *
 * The autopsy: `lastDay` is born a NUMBER (-1), is assigned a string LENGTH
 * (`toDateString().length` — 15), and the guard compares the date string
 * against `${lastDay}` — the string "15". "Mon Jul 20 2026" never equals
 * "15", so the condition is true on EVERY bar, the sums reset every bar,
 * and Σ(tp·v)/Σv over a single bar is just… tp. Typical price in a trench
 * coat, labeled VWAP.
 */
export function vwapBroken(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPv = 0;
  let cumV = 0;
  let lastDay = -1 as number;
  for (let i = 0; i < bars.length; i++) {
    const day = new Date(bars[i].t).toDateString().length; // simple, recomputed below
    const dayKey = new Date(bars[i].t).toDateString();
    // reset on session change (UTC day) — close-enough for demo
    if (dayKey !== `${lastDay}`) {
      cumPv = 0;
      cumV = 0;
      lastDay = day;
    }
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    cumPv += tp * bars[i].v;
    cumV += bars[i].v;
    out[i] = cumV ? cumPv / cumV : null;
  }
  return out;
}

/** (H+L+C)/3 per bar — what the broken line secretly was, all along. */
export function typicalPrice(bars: Bar[]): number[] {
  return bars.map((b) => (b.h + b.l + b.c) / 3);
}
