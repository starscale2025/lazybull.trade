import type { GeoDot } from "@/lib/admin-data";

// Simplified continent silhouettes — hand-drawn coordinates that read as a
// world map without needing a heavyweight TopoJSON dataset. Coords are in
// 0..1 space and scaled at render time.
const CONTINENTS = [
  // North America
  "M0.06,0.22 L0.13,0.18 L0.20,0.18 L0.27,0.24 L0.30,0.32 L0.27,0.42 L0.21,0.50 L0.15,0.50 L0.10,0.40 L0.07,0.32 Z",
  // South America
  "M0.27,0.55 L0.32,0.54 L0.35,0.62 L0.34,0.78 L0.30,0.88 L0.26,0.85 L0.24,0.74 L0.25,0.62 Z",
  // Europe
  "M0.46,0.24 L0.54,0.23 L0.58,0.30 L0.55,0.36 L0.50,0.36 L0.46,0.32 Z",
  // Africa
  "M0.48,0.38 L0.58,0.38 L0.62,0.50 L0.60,0.66 L0.54,0.74 L0.49,0.68 L0.47,0.55 Z",
  // Asia
  "M0.58,0.20 L0.78,0.20 L0.86,0.28 L0.88,0.40 L0.82,0.48 L0.74,0.50 L0.66,0.46 L0.60,0.36 Z",
  // SE Asia / Indonesia
  "M0.78,0.55 L0.84,0.54 L0.86,0.62 L0.81,0.62 Z",
  // Australia
  "M0.84,0.70 L0.92,0.70 L0.94,0.78 L0.88,0.82 L0.84,0.78 Z",
];

export function UserGeoMap({ dots }: { dots: GeoDot[] }) {
  const W = 720;
  const H = 360;
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">geo · live</span>
          <span className="text-fg-faint">·</span>
          <span>{dots.reduce((a, b) => a + b.n, 0)} sessions</span>
        </div>
        <span className="text-fg-faint">{dots.length} cities</span>
      </div>
      <div className="relative flex-1 overflow-hidden bg-bg">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
          {/* graticule (lat / lng) */}
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line key={`h${p}`} x1={0} x2={W} y1={p * H} y2={p * H} stroke="rgba(245,245,240,0.04)" />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line key={`v${p}`} x1={p * W} x2={p * W} y1={0} y2={H} stroke="rgba(245,245,240,0.04)" />
          ))}

          {/* continents */}
          {CONTINENTS.map((d, i) => {
            const scaled = d.replace(/(\d*\.?\d+),(\d*\.?\d+)/g, (_m, x, y) => `${(parseFloat(x) * W).toFixed(1)},${(parseFloat(y) * H).toFixed(1)}`);
            return <path key={i} d={scaled} fill="rgba(245,245,240,0.04)" stroke="rgba(245,245,240,0.18)" strokeWidth="0.6" />;
          })}

          {/* session dots */}
          {dots.map((d, i) => {
            const x = d.x * W;
            const y = d.y * H;
            const size = 3 + d.intensity * 7;
            return (
              <g key={d.city + i}>
                <circle
                  cx={x}
                  cy={y}
                  r={size + 4}
                  fill="var(--bull)"
                  opacity={0.12}
                />
                <circle cx={x} cy={y} r={size} fill="var(--bull)" opacity={0.55 + d.intensity * 0.4} />
                <circle cx={x} cy={y} r={1.5} fill="var(--bg)" />
                <text
                  x={x + size + 6}
                  y={y + 3}
                  fill="rgba(245,245,240,0.65)"
                  fontFamily="var(--font-jetbrains), ui-monospace, monospace"
                  fontSize="9"
                  letterSpacing="0.1em"
                >
                  {d.city.toUpperCase()} · {d.n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
