// Deterministic seeded random — keeps SSR and CSR identical.
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

export type Candle = {
  o: number;
  h: number;
  l: number;
  c: number;
};

export function generateCandles(
  count: number,
  seed = 7,
  start = 100,
  drift = 0.04,
  vol = 1.4
): Candle[] {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let last = start;
  for (let i = 0; i < count; i++) {
    const o = last;
    const trend = drift + (rand() - 0.5) * 0.04;
    const c = Math.max(1, o + (rand() - 0.5 + trend) * vol);
    const h = Math.max(o, c) + rand() * vol * 0.6;
    const l = Math.min(o, c) - rand() * vol * 0.6;
    candles.push({ o, h, l: Math.max(1, l), c });
    last = c;
  }
  return candles;
}

export function lastChange(candles: Candle[]) {
  if (candles.length < 2) return { abs: 0, pct: 0 };
  const first = candles[0].o;
  const last = candles[candles.length - 1].c;
  return { abs: last - first, pct: ((last - first) / first) * 100 };
}
