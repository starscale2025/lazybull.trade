// Scales and ticks for the figure kit. A scale maps a domain onto a pixel
// range; ticks land on "nice" steps (1, 2, 2.5 or 5 x 10^n) and always
// include zero when the domain crosses it, so a sign is never hidden.

export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number]; ticks: (n?: number) => number[] };

/** The smallest "nice" step at least `raw`. */
export function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(Math.abs(raw), 1e-12)));
  const norm = Math.abs(raw) / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
}

/** About `n` nice ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!(hi > lo)) return [lo];
  const step = niceStep((hi - lo) / Math.max(1, n));
  const out: number[] = [];
  for (let i = Math.ceil(lo / step - 1e-9); i * step <= hi + step * 1e-9; i++) out.push(+(i * step).toPrecision(12) || 0); // never -0
  return out;
}

/** [lo, hi] widened to the nearest nice ticks, holding zero if either end is near it. */
export function niceDomain(lo: number, hi: number, n = 5, includeZero = false): [number, number] {
  let a = includeZero ? Math.min(0, lo) : lo;
  let b = includeZero ? Math.max(0, hi) : hi;
  if (!(b > a)) [a, b] = [a - 1, b + 1];
  const step = niceStep((b - a) / Math.max(1, n));
  return [Math.floor(a / step + 1e-9) * step || 0, Math.ceil(b / step - 1e-9) * step || 0]; // never -0
}

// Ticks are always nice in VALUE space; a square-root scale only spreads them.
function make(domain: [number, number], range: [number, number], f: (v: number) => number): Scale {
  const [d0, d1] = domain.map(f);
  const s = ((v: number) => range[0] + ((f(v) - d0) / (d1 - d0 || 1)) * (range[1] - range[0])) as Scale;
  s.domain = domain;
  s.range = range;
  s.ticks = (n = 5) => niceTicks(Math.min(...domain), Math.max(...domain), n);
  return s;
}

export const linear = (domain: [number, number], range: [number, number]) => make(domain, range, (v) => v);

/** Square root, for heights that run to a spike (gamma near expiry). Signed. */
export const sqrt = (domain: [number, number], range: [number, number]) =>
  make(domain, range, (v) => Math.sign(v) * Math.sqrt(Math.abs(v)));

/** A number on an axis: the step's own decimals (0.025 -> 3, 0.5 -> 1, 25 -> 0), a real minus sign. */
export function tickLabel(v: number, step: number): string {
  const d = Math.min(6, (String(+Math.abs(step).toPrecision(6)).split(".")[1] ?? "").length);
  const s = Math.abs(v) < Math.abs(step) * 1e-6 ? (0).toFixed(d) : v.toFixed(d);
  return s.replace("-", "−");
}
