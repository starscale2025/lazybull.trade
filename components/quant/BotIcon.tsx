// Drawn icons for the bots. Each one is a tiny picture of what the model does
// (a crossover, a fan of paths, attention arcs), in one line weight and one
// colour, so the library reads as one family. They replace the emoji and stray
// symbols the bots used to wear. 24×24, stroke = currentColor.
import type { ReactNode } from "react";

const F = { opacity: 0.45 } as const; // a reference line: band, baseline, payoff
const D = { opacity: 0.55, strokeDasharray: "1.5 2.5" } as const; // a guide or barrier
const dot = (cx: number, cy: number, r = 1.4) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const ICONS: Record<string, ReactNode> = {
  // trend
  "sma-cross": (
    <>
      <path d="M3 15C8 14.2 13.5 12.6 21 9.5" {...F} />
      <path d="M3 19C7 19 9 16.5 11.5 13S16.5 6 21 5" />
    </>
  ),
  "rsi-rev": (
    <>
      <path d="M3 7H21M3 17H21" {...D} />
      <path d="M3 12C5 3.5 7.5 3.5 9 12S13 20.5 15 12S19 3.5 21 12" />
    </>
  ),
  macd: (
    <>
      <path d="M3 13H21" {...F} />
      <path d="M5 13V9.5M8 13V6.5M11 13V9M14 13V15.5M17 13V18.5M20 13V16" />
    </>
  ),
  donchian: (
    <>
      <path d="M3 7H21M3 18.5H21" {...F} />
      <path d="M3 14L6.5 11L9.5 15L13 9.5L16 12.5L21 3.5" />
    </>
  ),
  boll: (
    <>
      <path d="M3 12.5C9 12.5 14 11 21 11" {...F} />
      <path d="M3 9.5C8 9 12 4.5 21 6M3 15.5C8 16 12 19.5 21 16" />
    </>
  ),
  // stats
  zscore: (
    <>
      <path d="M3 19C7.5 19 8.5 6 12 6S16.5 19 21 19" />
      <path d="M18 20V13" {...D} />
      {dot(18, 13)}
    </>
  ),
  hurst: (
    <>
      <path d="M3 19L21 5" {...F} />
      {dot(5.5, 16.5)}
      {dot(9.5, 14.2)}
      {dot(13.5, 10.5)}
      {dot(17.5, 8.6)}
    </>
  ),
  kalman: (
    <>
      {dot(4, 14, 1.1)}
      {dot(7.5, 9.5, 1.1)}
      {dot(10.5, 14.5, 1.1)}
      {dot(13.5, 10, 1.1)}
      {dot(16.5, 12.5, 1.1)}
      {dot(19.5, 8, 1.1)}
      <path d="M3 13.5C8 11.5 13 12.5 21 9" />
    </>
  ),
  linreg: (
    <>
      <path d="M3 13L21 3M3 21L21 11" {...D} />
      <path d="M3 17L21 7" />
    </>
  ),
  // risk
  kelly: (
    <>
      <path d="M3 18H21" {...F} />
      <path d="M12 6V18" {...D} />
      <path d="M3 18C6 9 9.5 6 12 6S18 9 21 18" />
      {dot(12, 6)}
    </>
  ),
  "mc-var": (
    <>
      <path d="M4.5 20V17M7.5 20V12.5M10.5 20V7M13.5 20V5M16.5 20V9.5M19.5 20V15" />
      <path d="M6 3.5V20" {...D} />
    </>
  ),
  sharpe: (
    <>
      <path d="M3 18.2L16 4.4" {...F} />
      <path d="M7 20C7 12 11.5 7 21 5.5" />
      {dot(10.4, 10.3)}
    </>
  ),
  // options
  "bs-solver": (
    <>
      <path d="M3 18.5H11L21 5.5" {...F} />
      <path d="M3 17.5C9 17.2 12 14 21 4.8" />
    </>
  ),
  "iv-crush": (
    <>
      <path d="M12 3V21" {...D} />
      <path d="M3 8C6 7.2 9 6.5 11 6.3L13 15.5C15.5 16.3 18 16.6 21 16.7" />
    </>
  ),
  wheel: (
    <>
      <path d="M19 12A7 7 0 1 1 16.95 7.05" />
      <path d="M13.5 6.45L16.95 7.05L16.35 3.6" />
    </>
  ),
  // AI quants
  "ai-bs-surrogate": (
    <>
      <path d="M3 18.5H11L21 5.5" {...F} />
      {dot(3.5, 17.5, 1.15)}
      {dot(7, 17.2, 1.15)}
      {dot(10, 16, 1.15)}
      {dot(13, 13.6, 1.15)}
      {dot(16, 10.2, 1.15)}
      {dot(19, 6.8, 1.15)}
    </>
  ),
  "ai-iv-solver": (
    <>
      <path d="M3 12H11.7V20.5" {...D} />
      <path d="M3 19.5C8 16 13 10 21 4.5" />
      {dot(11.7, 12)}
    </>
  ),
  "ai-mc-surrogate": (
    <path d="M3 12L7 10.5L11 11L15 7.5L21 5M3 12L7 12.5L11 10.5L15 11.5L21 10M3 12L7 13L11 14.5L15 13.5L21 15M3 12L7 14L11 16L15 17.5L21 19" />
  ),
  "ai-american": (
    <>
      <path d="M4 12L10 8M4 12L10 16M10 8L16 4.5M10 8L16 12M10 16L16 12M10 16L16 19.5" {...F} />
      {dot(4, 12)}
      {dot(10, 8)}
      {dot(10, 16)}
      {dot(16, 4.5)}
      {dot(16, 12)}
      {dot(16, 19.5)}
    </>
  ),
  "ai-heston": (
    <path d="M3 12L4.5 11.5L6 12.4L7.5 11.7L9 12.3L10.5 11.8L12 9L13.2 15L14.4 7L15.6 16.5L16.8 8.5L18 14.5L19.5 10L21 12.5" />
  ),
  "ai-direction": (
    <>
      <path d="M3 12H10L20 6" />
      <path d="M10 12L20 18" {...D} />
      {dot(20, 6)}
    </>
  ),
  "ai-magnitude": (
    <>
      <path d="M3 16H17" {...D} />
      <path d="M3 16L7 14L10.5 15L14 10L17.5 7.5" />
      <path d="M20.5 16V7.5M19 16H22M19 7.5H22" />
    </>
  ),
  "ai-sequence": (
    <>
      <rect x="2.5" y="3.5" width="10.5" height="17" rx="2.5" {...D} />
      <path d="M5.5 6.5V17M10 5V14.5M15 9V19M19.5 6V15.5" />
      <path d="M5.5 9.5V14M10 7.5V11.5M15 11V16M19.5 8.5V12.5" strokeWidth="3.2" strokeLinecap="butt" />
    </>
  ),
  "ai-transformer": (
    <>
      <path d="M20 18C20 8 4 8 4 18M20 18C20 12 12 12 12 18M20 18C20 14.5 16 14.5 16 18" />
      {dot(4, 18)}
      {dot(8, 18)}
      {dot(12, 18)}
      {dot(16, 18)}
      {dot(20, 18)}
    </>
  ),
  "ai-quantile": (
    <>
      <path d="M11 12L21 5M11 12L21 17" {...D} />
      <path d="M3 13L5.5 12L8 13.5L11 12L21 10.5" />
    </>
  ),
  "ai-triple-barrier": (
    <>
      <path d="M4 6H19M4 18H19" {...F} />
      <path d="M19 6V18" {...D} />
      <path d="M4 12L7 13.5L10 11L13 12.5L15.5 8.5L17.5 6" />
      {dot(17.5, 6)}
    </>
  ),
  "ai-consensus": (
    <>
      <path d="M3 9C9 9 13 8 21 4" {...D} />
      <path d="M3 6.5C9 6.5 13 12 21 12M3 12H21M3 17.5C9 17.5 13 12 21 12" />
    </>
  ),
};

// A bot someone imported: a plain trace, so it still belongs to the family.
const FALLBACK = <path d="M3 16L8 11.5L12 14L16 8L21 10" />;

export function BotIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[id] ?? FALLBACK}
    </svg>
  );
}
