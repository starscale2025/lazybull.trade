/**
 * THE MARK (Phase 4, M25, 2026-11-09): lazybull's bull, drawn as a payoff.
 *
 * A long strangle at expiry is a flat floor with a line rising out of each
 * end: read as a head, the floor is the muzzle and the rising legs the
 * cheeks. The horns sweep out level from the brow and curl up at the tips
 * (Gate A4, after "it reads as a V": the first mark's horns were 12% flicks,
 * a straight continuation of the cheeks, and at 20 px it was a cup). It is
 * the film's last frame (the particles of the bull settle onto it,
 * public/cinema/scene.html), the phone film's last frame, and the nav's
 * logo, so the film ends on the same mark the page carries.
 *
 * Coordinates are a unit box, x and y in 0..1 with y down: the horn tips at
 * the top corners, the jaw along the bottom.
 */
export const BULL_MARK: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0], // left horn tip
  [0.09, 0.27],
  [0.29, 0.31], // the brow
  [0.4, 0.86], // the muzzle
  [0.6, 0.86],
  [0.71, 0.31],
  [0.91, 0.27],
  [1.0, 0.0], // right horn tip
];

/** The mark as an SVG `points` string in a box of `w` × `h`. */
export function bullMarkPoints(w: number, h: number, pad = 0): string {
  return BULL_MARK.map(([x, y]) => `${(pad + x * (w - 2 * pad)).toFixed(2)},${(pad + y * (h - 2 * pad)).toFixed(2)}`).join(" ");
}

/** `n` points spaced evenly along the mark, by arc length (for particles). */
export function bullMarkSamples(n: number): Array<[number, number]> {
  const seg = BULL_MARK.slice(1).map((p, i) => {
    const a = BULL_MARK[i];
    return { a, b: p, len: Math.hypot(p[0] - a[0], p[1] - a[1]) };
  });
  const total = seg.reduce((s, x) => s + x.len, 0);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    let d = (i / Math.max(1, n - 1)) * total;
    for (const s of seg) {
      if (d <= s.len || s === seg[seg.length - 1]) {
        const t = s.len ? Math.min(1, d / s.len) : 0;
        out.push([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
        break;
      }
      d -= s.len;
    }
  }
  return out;
}
