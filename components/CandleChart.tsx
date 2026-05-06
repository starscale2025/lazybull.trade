import { Candle } from "@/lib/candles";

type Props = {
  candles: Candle[];
  width?: number;
  height?: number;
  className?: string;
  showAxis?: boolean;
  showCrosshair?: boolean;
  bull?: string;
  bear?: string;
  gridColor?: string;
  showVolume?: boolean;
  glow?: boolean;
};

export function CandleChart({
  candles,
  width = 800,
  height = 360,
  className,
  showAxis = true,
  showCrosshair = false,
  bull = "var(--bull)",
  bear = "var(--bear)",
  gridColor = "rgba(245,245,240,0.06)",
  showVolume = false,
  glow = false,
}: Props) {
  const padL = showAxis ? 56 : 8;
  const padR = 8;
  const padT = 12;
  const padB = showVolume ? 60 : 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const padded = range * 0.08;
  const yMax = max + padded;
  const yMin = min - padded;
  const yRange = yMax - yMin;

  const slot = innerW / candles.length;
  const wickW = 1;
  const bodyW = Math.max(2, slot * 0.62);

  const yOf = (v: number) => padT + ((yMax - v) / yRange) * innerH;

  // Y axis ticks
  const ticks = 5;
  const tickValues = Array.from({ length: ticks }, (_, i) => yMin + (yRange * (ticks - 1 - i)) / (ticks - 1));

  // Closing line
  const linePath = candles
    .map((c, i) => {
      const x = padL + slot * i + slot / 2;
      const y = yOf(c.c);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="cc-line" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={bull} stopOpacity="0.4" />
          <stop offset="100%" stopColor={bull} stopOpacity="0" />
        </linearGradient>
        {glow && (
          <filter id="cc-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* horizontal grid lines */}
      {tickValues.map((v, i) => {
        const y = yOf(v);
        return (
          <g key={`h-${i}`}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={gridColor} strokeDasharray="2 4" />
            {showAxis && (
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontFamily="var(--font-jetbrains)"
                fontSize="9"
                fill="var(--fg-faint)"
              >
                {v.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}

      {/* vertical grid lines */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = padL + (innerW * i) / 6;
        return <line key={`v-${i}`} x1={x} x2={x} y1={padT} y2={padT + innerH} stroke={gridColor} strokeDasharray="1 6" />;
      })}

      {/* Filled area under close */}
      <path
        d={`${linePath} L${padL + slot * (candles.length - 1) + slot / 2},${padT + innerH} L${padL + slot / 2},${padT + innerH} Z`}
        fill="url(#cc-line)"
        opacity="0.6"
        className="svg-fade-in"
      />

      {/* Close line */}
      <path
        d={linePath}
        fill="none"
        stroke={bull}
        strokeOpacity="0.35"
        strokeWidth="1"
        filter={glow ? "url(#cc-glow)" : undefined}
        pathLength={1}
        className="svg-draw-in"
      />

      {/* Candles — fast-forward stagger from left to right, ~7ms per bar.
          Each candle group gets a per-index animation-delay; the CSS
          `chart-candle-in` keyframe fades opacity 0 → 1 in 220ms. The whole
          chart "plays" itself in over ~1s. */}
      {candles.map((c, i) => {
        const isBull = c.c >= c.o;
        const color = isBull ? bull : bear;
        const x = padL + slot * i + slot / 2;
        const yOpen = yOf(c.o);
        const yClose = yOf(c.c);
        const yHigh = yOf(c.h);
        const yLow = yOf(c.l);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        return (
          <g
            key={i}
            className="chart-candle-in"
            style={{ animationDelay: `${i * 7}ms` }}
          >
            <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={wickW} />
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyHeight}
              fill={color}
              opacity={isBull ? 1 : 1}
            />
          </g>
        );
      })}

      {/* Last marker — fades in after all candles have appeared. */}
      {(() => {
        const last = candles[candles.length - 1];
        const x = padL + slot * (candles.length - 1) + slot / 2;
        const y = yOf(last.c);
        const color = last.c >= last.o ? bull : bear;
        const lastMarkerDelay = candles.length * 7 + 200;
        return (
          <g
            className="chart-candle-in"
            style={{ animationDelay: `${lastMarkerDelay}ms`, animationDuration: "0.4s" }}
          >
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={color} strokeOpacity="0.35" strokeDasharray="3 3" />
            <rect x={width - padR - 50} y={y - 8} width="50" height="16" fill={color} />
            <text
              x={width - padR - 25}
              y={y + 4}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains)"
              fontSize="10"
              fontWeight="600"
              fill="var(--bg)"
            >
              {last.c.toFixed(2)}
            </text>
            <circle cx={x} cy={y} r="3" fill={color} />
            <circle cx={x} cy={y} r="6" fill="none" stroke={color} strokeOpacity="0.5" />
          </g>
        );
      })()}

      {/* Volume bars — same per-bar stagger as candles above. */}
      {showVolume &&
        candles.map((c, i) => {
          const isBull = c.c >= c.o;
          const color = isBull ? bull : bear;
          const x = padL + slot * i + slot / 2;
          const vol = Math.abs(c.h - c.l);
          const maxVol = Math.max(...candles.map((cc) => cc.h - cc.l));
          const h = (vol / maxVol) * 36;
          return (
            <rect
              key={`vol-${i}`}
              x={x - bodyW / 2}
              y={height - padB + 16 - h}
              width={bodyW}
              height={h}
              fill={color}
              opacity="0.4"
              className="chart-candle-in"
              style={{ animationDelay: `${i * 7}ms` }}
            />
          );
        })}
    </svg>
  );
}

export function MiniSpark({ candles, color = "var(--bull)", className }: { candles: Candle[]; color?: string; className?: string }) {
  const w = 200;
  const h = 60;
  const closes = candles.map((c) => c.c);
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  const range = max - min || 1;
  const stepX = w / (candles.length - 1);
  const path = closes
    .map((c, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(2)},${(h - ((c - min) / range) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} width="100%" height="100%">
      <defs>
        <linearGradient id="ms-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#ms-fill)" className="svg-fade-in" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" pathLength={1} className="svg-draw-in" />
    </svg>
  );
}
