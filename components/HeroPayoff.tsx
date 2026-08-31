"use client";

/**
 * THE HERO'S INSTRUMENT — the four feature chips become its controls.
 *
 * The hero used to make its case entirely in prose, over a background of 32
 * sine-generated fake candles. Two problems with that: a stock chart is not an
 * option (the site's whole claim is "Options you can see"), and the four chips
 * under the CTA were four inert labels, two of which repeated numbers from the
 * subhead one line above.
 *
 * So the chips drive a real payoff diagram. Hovering, focusing or tapping one
 * morphs the curve:
 *
 *   Visual chain      a long call — flat at max loss, hard kink at the strike,
 *                     uncapped above it. The shape the product draws for you.
 *   27 quant bots     a consensus band: where twelve models agree, and the
 *                     median they agree on.
 *   AI crash          the forecast cone, with the down-leg lit in --bear.
 *   $5K paper         the same call with the loss floored — training wheels on.
 *
 * That is the film's candle, consensus and safety acts in four hovers, with no
 * click and no page load.
 *
 * IMPLEMENTATION NOTE: all four shapes are rendered at once and crossfaded by
 * opacity. CSS cannot transition a <polyline>'s `points`, and animating it in JS
 * would mean a rAF loop in the hero for a hover effect. Four stacked polylines
 * cost nothing and transition on the brand's one curve.
 *
 * A11Y: the chips are real buttons in a labelled group, each pointing at a
 * visually-hidden sentence describing the shape — so the demo exists for a
 * keyboard and a screen reader, not only for a mouse.
 */

const W = 520;
const H = 190;
const ZERO = 116; // y of P&L = 0
const STRIKE = 0.44; // x fraction where the kink sits

const shape = (fn: (t: number) => number, n = 41) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return `${(t * W).toFixed(1)},${fn(t).toFixed(1)}`;
  }).join(" ");

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// 0 · long call — the canonical shape
const LONG_CALL = shape((t) =>
  t < STRIKE ? ZERO + 46 : clamp(ZERO + 46 - ((t - STRIKE) / (1 - STRIKE)) * 150, ZERO - 100, ZERO + 46)
);
// 1 · consensus — the median the models agree on
const CONSENSUS = shape((t) => ZERO + 34 - t * 96 + Math.sin(t * 7.5) * 5);
// 2 · the forecast cone's centre line
const CONE = shape((t) => ZERO - 6 - Math.sin(t * 2.2) * 12 + t * t * 58);
// 3 · capped: the same call with the loss floored
const CAPPED = shape((t) =>
  t < STRIKE ? ZERO + 30 : clamp(ZERO + 30 - ((t - STRIKE) / (1 - STRIKE)) * 118, ZERO - 74, ZERO + 30)
);

const STATES = [
  { points: LONG_CALL, stroke: "var(--bull)", note: "A long call: your loss is flat and chosen, your upside is uncapped above the strike." },
  { points: CONSENSUS, stroke: "var(--cyan)", note: "Twelve models voting, and the median they agree on." },
  { points: CONE, stroke: "var(--amber)", note: "A probability cone: the range the model expects price to land in." },
  { points: CAPPED, stroke: "var(--bull)", note: "The same position with the loss floored — training wheels on." },
];

export function HeroPayoff({
  labels,
  activeIndex,
  onActivate,
}: {
  labels: readonly string[];
  activeIndex: number;
  onActivate: (i: number) => void;
}) {
  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="pointer-events-none block h-auto w-full max-w-[32.5rem]"
        aria-hidden
      >
        {/* the zero line everything is measured against */}
        <line
          x1="0"
          y1={ZERO}
          x2={W}
          y2={ZERO}
          stroke="var(--fg-faint)"
          strokeDasharray="4 7"
          strokeWidth="1"
          opacity="0.45"
        />
        {/* the strike — the one x the kink is pinned to */}
        <line
          x1={W * STRIKE}
          y1="8"
          x2={W * STRIKE}
          y2={H - 8}
          stroke="var(--fg-faint)"
          strokeWidth="1"
          opacity="0.2"
        />
        {STATES.map((s, i) => (
          <polyline
            key={i}
            points={s.points}
            fill="none"
            stroke={s.stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="hero-payoff-line"
            data-on={i === activeIndex ? "1" : "0"}
            // The opacity is ALSO inline, not only in the stylesheet. All four
            // shapes are stacked, so if the page paints before globals.css
            // arrives the class does nothing and every curve renders at full
            // strength — four crossing lines at once, which reads as a broken
            // chart rather than a loading one. Inline wins that race; the class
            // still owns the transition between states.
            style={{ opacity: i === activeIndex ? 0.95 : 0 }}
          />
        ))}
      </svg>

      {/* The controls. A real group of real buttons. */}
      <div
        role="group"
        aria-label="Show what the terminal draws"
        className="grid grid-cols-1 justify-items-center gap-2.5 sm:grid-cols-2 lg:flex lg:gap-3"
      >
        {labels.map((f, i) => (
          <button
            key={f}
            type="button"
            aria-pressed={i === activeIndex}
            aria-describedby={`hero-payoff-note-${i}`}
            onMouseEnter={() => onActivate(i)}
            onFocus={() => onActivate(i)}
            onClick={() => onActivate(i)}
            data-on={i === activeIndex ? "1" : "0"}
            className="hero-chip surface-instrument specular flex items-center justify-center gap-2 border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-3.5 py-2 text-center t-chrome text-fg-dim"
          >
            <span
              aria-hidden
              className="size-1 shrink-0 rounded-full bg-bull"
              style={{ boxShadow: "var(--glow-rail)" }}
            />
            {f}
            <span id={`hero-payoff-note-${i}`} className="sr-only">
              {STATES[i]?.note}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
