/**
 * THE P&L SPINE — one continuous payoff curve threaded down the whole marketing
 * region, morphing per section.
 *
 * The region below the film had a real problem: four consecutive stock
 * marketing layouts (three steps, three feature rows, a safety panel, two
 * pricing cards) that DESCRIBE "options you can see" in prose and never once
 * show it. The only place the claim was demonstrated was a 260px thumbnail
 * inside Safety — whose own comment admitted exactly that.
 *
 * So the argument becomes the geometry. One line runs behind everything and
 * changes shape as you read:
 *
 *   Workflow  flat, with three rising kinks — you have no position yet, just
 *             three steps.
 *   Product   the legs snap on: a real multi-leg structure, one leg per
 *             feature row.
 *   Safety    the curve CAPS. The section's whole claim, drawn.
 *   Pricing   it splits — Free stays flat at zero forever (which is both the
 *             joke and the truth), Pro runs capped-up.
 *
 * WHY THIS IS A SERVER COMPONENT AND STAYS ONE:
 * The marketing region ships zero client JS on purpose — the landing already
 * carries ~1.3MB of three.js and scripts/guard.mjs budgets 4.6MB. So the morph
 * is declared as `data-gsap="payoff"` plus four keyframe attributes, and the
 * already-mounted global GsapScroller picks it up. No "use client" here, no new
 * bundle, and the guard never notices.
 *
 * The shapes are <polyline> POINT LISTS, not path data, because GSAP core's
 * AttrPlugin can tween a list of numbers but cannot morph a path — that needs
 * the paid MorphSVGPlugin. Every shape therefore carries the SAME point count.
 */

const N = 33; // points per shape — all four must match exactly
const W = 1000;
const H = 420;
const ZERO = 250; // the y of P&L = 0

/** Build a point list from a function of t (0..1) returning a y in view units. */
function shape(fn: (t: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push(`${(t * W).toFixed(1)},${fn(t).toFixed(1)}`);
  }
  return pts.join(" ");
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// 01 · WORKFLOW — flat, three rising kinks. Three steps, no position yet.
const WORKFLOW = shape((t) => {
  const steps = Math.floor(t * 3);
  return ZERO + 60 - steps * 22 - (t * 3 - steps) * 6;
});

// 02 · PRODUCT — the legs snap on. A long call spread: capped both ends.
const PRODUCT = shape((t) => {
  const lo = 0.3, hi = 0.62;
  if (t < lo) return ZERO + 78;
  if (t > hi) return ZERO - 92;
  return ZERO + 78 - ((t - lo) / (hi - lo)) * 170;
});

// 03 · SAFETY — the curve CAPS. Flat at a loss you chose, up, flat again.
const SAFETY = shape((t) => {
  const lo = 0.34, hi = 0.58;
  if (t < lo) return ZERO + 96;
  if (t > hi) return ZERO - 70;
  return ZERO + 96 - ((t - lo) / (hi - lo)) * 166;
});

// 04 · PRICING — Pro: uncapped above the strike. (Free is the flat line below.)
const PRICING = shape((t) => {
  const k = 0.28;
  if (t < k) return ZERO + 52;
  return clamp(ZERO + 52 - ((t - k) / (1 - k)) * 190, ZERO - 108, ZERO + 52);
});

export function PayoffSpine() {
  return (
    <div
      aria-hidden
      // NO overflow-hidden here. An ancestor with overflow:hidden becomes the
      // scroll container for `position: sticky`, and since this wrapper does not
      // itself scroll, the sticky child below simply travelled with it — measured
      // at top:-3266 by the pricing section instead of pinning at 0. The SVG is
      // inset within this box anyway, so there was nothing to clip.
      className="pointer-events-none absolute inset-0 z-0"
    >
      {/* STICKY, not stretched. Spanning the SVG across the whole ~4,100px
          track made the curve mathematically present and visually absent: any
          one 900px viewport showed a ~20% slice of it, which reads as a stray
          diagonal, not a payoff. Pinned to the viewport instead, a WHOLE curve
          sits behind whatever section you are reading, and the morph is the
          thing that changes as you scroll — which is the actual idea. */}
      <div className="sticky top-0 h-screen w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-x-0 top-1/2 h-[62%] w-full -translate-y-1/2"
        >
        {/* the zero line the whole argument is measured against */}
        <line
          x1="0"
          y1={ZERO}
          x2={W}
          y2={ZERO}
          stroke="var(--fg-faint)"
          strokeWidth="1"
          strokeDasharray="5 9"
          opacity="0.28"
          vectorEffect="non-scaling-stroke"
        />
        {/* FREE: flat at zero, forever. Fades in only as Pricing arrives — it is
            the second half of that section's joke, and it would be noise
            anywhere above it. */}
        <line
          x1="0"
          y1={ZERO}
          x2={W}
          y2={ZERO}
          stroke="var(--fg-dim)"
          strokeWidth="2"
          opacity="0.22"
          vectorEffect="non-scaling-stroke"
          data-gsap="fade-up-soft"
          data-gsap-start="top 20%"
        />
        {/* THE SPINE */}
        <polyline
          points={WORKFLOW}
          fill="none"
          stroke="var(--bull)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.62"
          vectorEffect="non-scaling-stroke"
          data-gsap="payoff"
          data-payoff-1={WORKFLOW}
          data-payoff-2={PRODUCT}
          data-payoff-3={SAFETY}
          data-payoff-4={PRICING}
        />
        </svg>
      </div>
    </div>
  );
}
