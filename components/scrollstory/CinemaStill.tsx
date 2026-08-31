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
 * So this draws the film's decisive beat instead of describing it: the forecast
 * cone opening at the call, and price falling into its lower half — "flagged
 * DOWN, 12 bars early; reality fell into the cone it drew." That is the one
 * moment that carries the product's whole claim, and it is pure static SVG:
 * legal under reduced-motion, and it needs no GPU, which is precisely why the
 * other two audiences are here.
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
const SPLIT = 292; // x of the call — history left, forecast right
const BASE = 150; // y of the price at the moment of the call

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

// ── history: the tape up to the call. Mildly upward, so the DOWN call is a
//    genuine contrarian read rather than an extrapolation of a visible slide.
const rHist = rng(20250824);
const HISTORY: Array<[number, number]> = [];
for (let i = 0; i <= 46; i++) {
  const t = i / 46;
  const x = t * SPLIT;
  const drift = -26 * t; // up and to the right
  const wobble = Math.sin(t * 9.4) * 7 + (rHist() - 0.5) * 9;
  HISTORY.push([x, BASE + 18 + drift + wobble]);
}
const CALL_Y = HISTORY[HISTORY.length - 1][1];

// ── the cone. Widens with √t, the way a diffusion band actually does — a
//    straight-edged triangle is the tell of a cone drawn by someone who has
//    never priced one.
// The forecast stops SHORT of the frame edge. Run it to x=W and the cone is
// guillotined by the viewBox — it reads as a picture someone cropped badly
// rather than as a band that resolves. The gap is the drawing's margin.
const RIGHT_PAD = 52;
const SPAN = W - SPLIT - RIGHT_PAD;
const BARS = 34; // steps of `reality` — the unit the "12 bars" claim counts in
const EARLY = 12;
const halfWidth = (t: number) => Math.sqrt(t) * 96;
const UPPER: Array<[number, number]> = [];
const LOWER: Array<[number, number]> = [];
for (let i = 0; i <= 30; i++) {
  const t = i / 30;
  const x = SPLIT + t * SPAN;
  const centre = CALL_Y + t * 34; // the ensemble's median: down
  UPPER.push([x, centre - halfWidth(t)]);
  LOWER.push([x, centre + halfWidth(t)]);
}
const CONE_FILL = `${pts(UPPER)} ${pts([...LOWER].reverse())}`;

// ── reality: what actually happened. Stays inside the cone the whole way and
//    finishes in its lower half — vindication, not a lucky straight line.
const rReal = rng(77);
const REALITY: Array<[number, number]> = [];
for (let i = 0; i <= BARS; i++) {
  const t = i / BARS;
  const x = SPLIT + t * SPAN;
  const centre = CALL_Y + t * 34;
  const fall = Math.pow(t, 1.35) * 58; // slow at first, then the drop
  const wobble = Math.sin(t * 11) * 6 * (1 - t * 0.4) + (rReal() - 0.5) * 7;
  const y = centre + fall + wobble;
  const lo = centre + halfWidth(t) - 4;
  REALITY.push([x, Math.min(y, lo)]);
}
const END = REALITY[REALITY.length - 1];
// where the twelfth bar lands — the bracket below measures exactly the claim
const EARLY_X = SPLIT + (EARLY / BARS) * SPAN;

/** The acts, in order. `lede` marks the two that carry the climax. */
// THE THIRD COPY OF THE FILM'S STORY. lib/cinema.ts drives the desktop film,
// MobileCinema carries the phone's, and this static index is what a
// reduced-motion visitor — the person most likely to actually READ it — gets
// instead. It was the last place still shipping the spec sheet, including a
// "historically 65–77% right" win rate no reader can check, on a financial
// education product. Three surfaces, one story: change a beat and change it in
// all three.
const INDEX = [
  { n: "01", h: "A desk that shows its work.", s: "Every number here can be opened." },
  { n: "02", h: "Nothing here costs you money.", s: "Paper only — so you can afford to be wrong on purpose." },
  { n: "03", h: "Markets have moods.", s: "Trending, reverting, or noise — named before you commit to anything." },
  { n: "04", h: "Your worst case is a number you chose.", s: "Not a number you find out afterwards." },
  { n: "05", h: "They vote. They disagree.", s: "You see the split, not just the answer." },
  { n: "06", h: "Learn it. Backtest it.", s: "Only then trade it." },
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
            It flagged <span className="text-bear">DOWN</span> twelve bars early.
          </h2>
          <p className="measure-wide mt-4 text-fg-dim">
            Then reality fell into the cone it drew. Everything below is what the
            terminal does around that one call — read in order, because the order
            is the argument.
          </p>

          <figure className="mt-9">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full"
              role="img"
              aria-label="A price chart. The line rises gently, then a forecast cone opens at the moment of the call and widens to the right. The price that followed falls through the lower half of the cone, ending near its floor."
            >
              {/* THE BAND THE MODEL COMMITTED TO — dissolving rightward.
                  Drawn as a closed polygon it ended on a hard vertical chord,
                  which reads as a wall: a shape that stopped rather than a
                  forecast getting less certain. The mask fades the fill AND
                  both boundaries together over the last third, so the cone runs
                  out of confidence instead of running out of room. `reality`
                  sits outside this group and stays at full strength — what
                  actually happened is not in doubt. */}
              <defs>
                {/* userSpaceOnUse across the CONE's own x-extent, not the
                    viewBox's. Spanning 0..W left the terminus at ~21% instead
                    of 0, so the chord was dimmer but still visibly there. */}
                <linearGradient
                  id="cs-fade"
                  gradientUnits="userSpaceOnUse"
                  x1={SPLIT}
                  x2={SPLIT + SPAN}
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="0.46" stopColor="#fff" />
                  <stop offset="1" stopColor="#000" />
                </linearGradient>
                <mask id="cs-cone-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                  <rect x="0" y="0" width={W} height={H} fill="url(#cs-fade)" />
                </mask>
              </defs>
              <g mask="url(#cs-cone-mask)">
                <polygon points={CONE_FILL} fill="var(--amber)" opacity="0.15" />
                <polyline
                  points={pts(UPPER)}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="1.25"
                  opacity="0.6"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={pts(LOWER)}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="1.25"
                  opacity="0.6"
                  vectorEffect="non-scaling-stroke"
                />
              </g>

              {/* the call: one rule, and the only vertical in the picture */}
              <line
                x1={SPLIT}
                y1="18"
                x2={SPLIT}
                y2={H - 40}
                stroke="var(--fg-faint)"
                strokeDasharray="3 6"
                strokeWidth="1"
                opacity="0.55"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={SPLIT - 9}
                y="26"
                textAnchor="end"
                fill="var(--fg-faint)"
                className="t-chrome"
                style={{ fontSize: 10, letterSpacing: "0.14em" }}
              >
                the call
              </text>

              {/* the tape before it */}
              <polyline
                points={pts(HISTORY)}
                fill="none"
                stroke="var(--fg-dim)"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* what happened */}
              <polyline
                points={pts(REALITY)}
                fill="none"
                stroke="var(--bear)"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={END[0]} cy={END[1]} r="3.5" fill="var(--bear)" />
              <circle cx={SPLIT} cy={CALL_Y} r="3" fill="var(--fg)" opacity="0.85" />

              {/* THE CLAIM, MEASURED. The headline says twelve bars early; this
                  brackets exactly twelve, so the picture states the number
                  rather than leaving the reader to take it on faith. */}
              <g stroke="var(--fg-faint)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.8">
                <line x1={SPLIT} y1={H - 26} x2={EARLY_X} y2={H - 26} />
                <line x1={SPLIT} y1={H - 30} x2={SPLIT} y2={H - 22} />
                <line x1={EARLY_X} y1={H - 30} x2={EARLY_X} y2={H - 22} />
              </g>
              <text
                x={(SPLIT + EARLY_X) / 2}
                y={H - 10}
                textAnchor="middle"
                fill="var(--fg-faint)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em" }}
              >
                12 BARS
              </text>
            </svg>
            <figcaption className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { c: "var(--fg-dim)", t: "tape" },
                { c: "var(--amber)", t: "forecast cone" },
                { c: "var(--bear)", t: "what happened" },
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
