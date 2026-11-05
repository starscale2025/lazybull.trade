/**
 * THE FILM, AS ONE PRINTED FRAME — what you get instead of the cinematic.
 *
 * Three audiences land here, and none of them chose to: `prefers-reduced-motion`
 * users, machines with no WebGL, and anyone whose scene failed to load. What
 * they used to get was eight headlines stacked dead-centre at equal weight over
 * a baked hero at 20% opacity — a transcript, not a frame. Three problems with
 * that:
 *
 *   1. NO HIERARCHY. The film has an argument with a climax; the list gave the
 *      boot splash and the crash-call the same size, so the climax vanished.
 *   2. NOTHING WAS SHOWN. On a site whose whole claim is "options you can see",
 *      the accessible path was the one route that only ever TOLD you.
 *   3. THE ART WAS A JPEG OF THE THING. A 20%-opacity screenshot of the film is
 *      a picture of what you are missing.
 *
 * So this draws the film's decisive beat instead of describing it: the price
 * falls through the lower strike of a defined-risk position and keeps falling,
 * while the position's loss stops at the floor chosen before the trade. It used
 * to draw a down-biased forecast cone that "called" the crash; the 2026-11
 * tribunal found that oracle here, in the largest type a reduced-motion reader
 * meets. Nothing is predicted now, only bounded. It is pure static SVG: legal
 * under reduced-motion, and it needs no GPU, which is precisely why the other
 * two audiences are here.
 *
 * Everything else the film says becomes a numbered index. The numbers are not
 * decoration — the film IS a sequence, and the order is the argument: it reads
 * the regime BEFORE it calls the move, and it makes you paper-trade it AFTER.
 *
 * NO ANIMATION AND NO CLIENT STATE, deliberately. This module is imported by a
 * client component, so it costs bundle bytes; it stays pure markup so that cost
 * is a few hundred bytes of geometry rather than a second scene.
 */

const W = 640;
const H = 300;
const SPLIT = 292; // x where the drop begins — the tape left, the crash right
const BASE = 150; // y of the price where the drop begins
const RIGHT_PAD = 52;
const SPAN = W - SPLIT - RIGHT_PAD;

/** Deterministic noise. A screenshot of this page must not shift between runs. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pts = (a: Array<[number, number]>) =>
  a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// ── the tape: mildly upward into the drop, so the fall is a surprise rather
//    than an extrapolation of a visible slide.
const rHist = rng(20250824);
const HISTORY: Array<[number, number]> = [];
for (let i = 0; i <= 46; i++) {
  const t = i / 46;
  const wobble = Math.sin(t * 9.4) * 7 + (rHist() - 0.5) * 9;
  HISTORY.push([t * SPLIT, BASE + 18 - 26 * t + wobble]);
}
const START_Y = HISTORY[HISTORY.length - 1][1];

// ── the lower strike of a bull call spread. Below it the spread's loss is
//    fixed at what it cost, so this line is where the position stops losing.
const K1_Y = START_Y + 62;

// ── the crash: slow at first, then through the strike and well past it.
const rFall = rng(77);
const CRASH: Array<[number, number]> = [];
for (let i = 0; i <= 34; i++) {
  const t = i / 34;
  const wobble = Math.sin(t * 11) * 6 * (1 - t * 0.4) + (rFall() - 0.5) * 7;
  CRASH.push([SPLIT + t * SPAN, START_Y + Math.pow(t, 1.35) * 118 + wobble]);
}
const END = CRASH[CRASH.length - 1];

/** The acts, in order. `lede` marks the two that carry the climax. */
// THE THIRD COPY OF THE FILM'S STORY. lib/cinema.ts drives the desktop film,
// MobileCinema carries the phone's, and this static index is what a
// reduced-motion visitor — the person most likely to actually READ it — gets
// instead. It was the last place still shipping the spec sheet, including a
// historical win-rate range no reader can check, on a financial-education
// product. Three surfaces, one story: change a beat and change it in all
// three.
const INDEX = [
  { n: "01", h: "A desk that shows its work.", s: "Every number here can be opened." },
  { n: "02", h: "No trade here uses real money.", s: "Paper only — so you can afford to be wrong on purpose." },
  { n: "03", h: "Markets have moods.", s: "Trending, reverting, or noise — named before you commit to anything." },
  { n: "04", h: "Your worst case is a number you chose.", s: "Not a number you find out afterwards." },
  { n: "05", h: "They vote. They disagree.", s: "You see the split, not just the answer." },
  { n: "06", h: "Learn it. Backtest it.", s: "Then paper-trade it." },
];

export function CinemaStill() {
  return (
    <section
      data-cinema-static
      className="relative border-b border-border bg-bg"
    >
      <div className="shell grid gap-14 section-y lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        {/* ── THE FRAME ─────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center">
          <div className="t-eyebrow text-fg-faint">The film, in one frame</div>
          <h2 className="mt-4 font-display text-[clamp(2rem,4.4vw,3.25rem)] leading-[0.98] tracking-tightest text-fg [text-wrap:balance]">
            Your worst case is a number you <span className="text-bear">chose</span>.
          </h2>
          <p className="measure-wide mt-4 text-fg-dim">
            The price fell through the lower strike and kept falling. A
            defined-risk position stops losing there: the most it can lose is
            what it cost, set before the trade. Here you watch that happen with
            nothing at stake. Everything below is what the desk does around that
            one idea; read it in order, because the order is the argument.
          </p>

          <figure className="mt-9">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full"
              role="img"
              aria-label="A price chart. The line rises gently, then falls sharply through a horizontal line marking the lower strike of a bull call spread, and keeps falling. The area below the strike is labelled: below this strike the position's loss stops at minus 80 dollars."
            >
              {/* below the strike: the part of the fall a defined-risk position never pays for */}
              <rect x={SPLIT} y={K1_Y} width={W - SPLIT} height={H - K1_Y} fill="var(--bear)" opacity="0.07" />

              {/* the strike itself — the floor, set before the trade */}
              <line
                x1="0"
                y1={K1_Y}
                x2={W}
                y2={K1_Y}
                stroke="var(--bear)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <text x="10" y={K1_Y - 8} fill="var(--fg-dim)" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em" }}>
                K1 · LOWER STRIKE
              </text>
              <text x={W - 10} y={K1_Y + 20} textAnchor="end" fill="var(--fg)" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                below this strike, the loss stops at −$80
              </text>

              {/* the tape before the drop */}
              <polyline
                points={pts(HISTORY)}
                fill="none"
                stroke="var(--fg-dim)"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* the drop — price is not bounded, only the position is */}
              <polyline
                points={pts(CRASH)}
                fill="none"
                stroke="var(--bear)"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={END[0]} cy={END[1]} r="3.5" fill="var(--bear)" />
            </svg>
            <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { c: "var(--fg-dim)", t: "price" },
                { c: "var(--bear)", t: "the drop, and the strike where the loss stops" },
              ].map((k) => (
                <span key={k.t} className="flex items-center gap-2 t-chrome text-fg-faint">
                  <span
                    aria-hidden
                    className="h-px w-5 shrink-0"
                    style={{ background: k.c }}
                  />
                  {k.t}
                </span>
              ))}
              <span className="t-chrome text-fg-faint">illustrative · paper-only</span>
            </figcaption>
          </figure>
        </div>

        {/* ── THE INDEX ─────────────────────────────────────────────────── */}
        <ol className="flex flex-col justify-center gap-0 border-t border-border lg:border-t-0">
          {INDEX.map((a) => (
            <li
              key={a.n}
              className="flex gap-5 border-b border-border py-5 first:lg:border-t"
            >
              <span className="t-data mt-1 shrink-0 text-xs text-fg-faint">{a.n}</span>
              <span className="min-w-0">
                <span className="block font-display text-xl leading-tight tracking-tight text-fg md:text-2xl">
                  {a.h}
                </span>
                <span className="mt-1.5 block font-mono text-[0.8125rem] leading-snug text-fg-dim">
                  {a.s}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
