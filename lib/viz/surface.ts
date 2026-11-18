// The oblique surface projector, lifted out of /greeks (plan A5, Stage 3) so
// the Greeks lab and the model simulations draw surfaces the same way. A grid
// of values z[j][i] (j along the depth axis, i across) becomes quads in the
// order a painter would lay them, back to front, each tagged with its mean
// height for the ramp. Opaque quads hide the lines behind them, so a surface
// reads as a surface, not a tangle of wire.

export type Vec = { x: number; y: number };
export type Projector = { origin: Vec; u: Vec; v: Vec; height: number };

/** /greeks' camera: strike across, days into the page, a tall height axis. */
export const GREEKS_PROJECTOR: Projector = { origin: { x: 96, y: 490 }, u: { x: 516, y: 96 }, v: { x: 556, y: -88 }, height: 360 };

export function project(P: Projector, u: number, v: number, h: number): Vec {
  return { x: P.origin.x + u * P.u.x + v * P.v.x, y: P.origin.y + u * P.u.y + v * P.v.y - h * P.height };
}

export type Quad = { d: string; t: number };

/**
 * Quads for a grid, painted back to front. Heights are placed on [lo, hi]
 * and held at its edges; `t` is the quad's mean height in [0, 1] for the ramp.
 * A grid is j rows (depth, 0 = front) of i columns (across, 0 = left).
 */
export function surfaceQuads(z: number[][], lo: number, hi: number, P: Projector): Quad[] {
  const rows = z.length;
  const cols = z[0]?.length ?? 0;
  const h = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const out: Quad[] = [];
  // the far rows first: v grows into the page
  for (let j = rows - 2; j >= 0; j--) {
    for (let i = 0; i < cols - 1; i++) {
      const c = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ] as const;
      const hs = c.map(([a, b]) => h(z[b][a]));
      const pts = c.map(([a, b], k) => project(P, a / (cols - 1), b / (rows - 1), hs[k]));
      out.push({ d: `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z`, t: (hs[0] + hs[1] + hs[2] + hs[3]) / 4 });
    }
  }
  return out;
}
