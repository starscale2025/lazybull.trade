// A height surface in the figure kit: opaque quads coloured on the brand
// ramp by height, painted back to front, always beside the ramp's legend bar
// (rule 3). Static and server-renderable; the Greeks lab drives the same maths
// (lib/viz/surface.ts) interactively.

import { RampLegend } from "./frame";
import { rampVar } from "@/lib/viz/ramp";
import { GREEKS_PROJECTOR, surfaceQuads, type Projector } from "@/lib/viz/surface";

export function SurfaceFigure({
  title,
  desc,
  z,
  lo,
  hi,
  legend,
  projector = GREEKS_PROJECTOR,
  width = 1200,
  height = 640,
  id,
}: {
  title: string;
  desc: string;
  z: number[][];
  lo: number;
  hi: number;
  legend: { lo: string; hi: string; label: string };
  projector?: Projector;
  width?: number;
  height?: number;
  id?: string;
}) {
  const fid = id ?? `fig-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  const quads = surfaceQuads(z, lo, hi, projector);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${fid}-t ${fid}-d`} className="block h-auto w-full overflow-visible">
      <title id={`${fid}-t`}>{title}</title>
      <desc id={`${fid}-d`}>{desc}</desc>
      {quads.map((q, k) => (
        <path key={k} d={q.d} fill={rampVar(q.t)} stroke="var(--bg)" strokeWidth={0.6} strokeOpacity={0.55} />
      ))}
      <RampLegend x={24} y={projector.origin.y - projector.height + 30} height={projector.height * 0.6} lo={legend.lo} hi={legend.hi} label={legend.label} size={2} />
    </svg>
  );
}
