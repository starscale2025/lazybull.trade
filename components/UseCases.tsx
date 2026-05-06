import { generateCandles } from "@/lib/candles";
import { MiniSpark } from "./CandleChart";

const PROFILES = [
  {
    no: "01",
    glyph: "✦",
    code: "BEGINNER-01",
    title: "Just Curious",
    quote: "I always thought options were a black box. Now I just drag two squares.",
    pitch:
      "You've never traded an option before. The visual chain shows what's expensive (red) and what's cheap (green). Drag two cells, the AI teacher tells you what you just built and what could go wrong.",
    stats: [
      { k: "Time to first trade", v: "4m" },
      { k: "Risk wizard", v: "on" },
      { k: "Paper balance", v: "$100k" },
    ],
    tools: ["Risk wizard", "Teacher", "Paper $100k", "Kill switch"],
    seed: 3,
    color: "var(--bull)",
    accent: "bg-bull",
  },
  {
    no: "02",
    glyph: "◐",
    code: "LEARNER-07",
    title: "The Self-Taught",
    quote: "I'd watched 40 hours of YouTube and still didn't get an iron condor. Took 30 seconds here.",
    pitch:
      "You know the names — calls, puts, spreads — but the geometry never clicked. Every drag generates a labelled P&L diagram with breakevens, max profit, and max loss. The teacher fills in the why.",
    stats: [
      { k: "Strategies covered", v: "14+" },
      { k: "Greek explainers", v: "6" },
      { k: "Diagrams / day", v: "∞" },
    ],
    tools: ["Greek hover", "P&L diagram", "Multi-leg detect", "Examples"],
    seed: 41,
    color: "var(--cyan)",
    accent: "bg-cyan",
  },
  {
    no: "03",
    glyph: "▲",
    code: "ACTIVE-Σ",
    title: "The Active Trader",
    quote: "Faster than any chain I've used. The drag-build is genuinely the right interface.",
    pitch:
      "You trade options weekly. The chain prices in 0.4ms, the heatmap shows IV skew at a glance, and right-click adds a short leg. Six expiries, 23 strikes, every greek live — without leaving the keyboard.",
    stats: [
      { k: "Chain price", v: "0.4ms" },
      { k: "Strikes / chain", v: "23" },
      { k: "Expiries", v: "6" },
    ],
    tools: ["Heatmap", "Right-click short", "Live greeks", "Hotkeys"],
    seed: 91,
    color: "var(--plasma)",
    accent: "bg-plasma",
  },
  {
    no: "04",
    glyph: "◉",
    code: "TEACHER-Ω",
    title: "The Mentor",
    quote: "I teach options on the weekend. Now I just share a link and they get it on their own.",
    pitch:
      "You teach friends, students, or a small community. Every strategy comes with a plain-English explanation, an animated Greek icon, and a P&L curve. The training-wheels mode means you can hand them the keys without worrying.",
    stats: [
      { k: "Account types", v: "kid-safe" },
      { k: "Loss limit", v: "$ daily" },
      { k: "Auto-close", v: "on breach" },
    ],
    tools: ["Plain-English mode", "Loss limits", "Defined-risk only", "Replay"],
    seed: 17,
    color: "var(--amber)",
    accent: "bg-amber",
  },
];

export function UseCases() {
  return (
    <section className="relative border-b border-border bg-bg">

      {/* Section header */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-24 pb-12">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ Section 02 / Who-it's-for
            </span>
            <span className="font-mono text-[11px] text-bull">// who.md</span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-[clamp(2.5rem,6vw,5.6rem)] leading-[0.92] tracking-tightest text-fg">
              Built for everyone
              <br />
              <span className="italic font-light text-fg-dim">
                options{" "}
                <span className="text-bull not-italic font-normal">scared off</span>.
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Profile grid */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-24">
        <div
          data-gsap="stagger"
          data-gsap-duration="1.1"
          className="grid grid-cols-1 gap-px bg-border md:grid-cols-2"
        >
          {PROFILES.map((p, i) => {
            const candles = generateCandles(40, p.seed, 100, 0.04, 1.6);
            return (
              <article
                key={p.no}
                className="group relative flex flex-col bg-bg p-6 transition-colors hover:bg-surface md:p-8"
              >
                {/* corner crosshairs */}
                <span className="absolute left-2 top-2 size-2 border-l border-t border-fg-faint" />
                <span className="absolute right-2 top-2 size-2 border-r border-t border-fg-faint" />
                <span className="absolute left-2 bottom-2 size-2 border-l border-b border-fg-faint" />
                <span className="absolute right-2 bottom-2 size-2 border-r border-b border-fg-faint" />

                {/* Header */}
                <div className="flex items-start justify-between border-b border-border-soft pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                      FILE
                    </span>
                    <span className="font-mono text-sm text-fg">{p.no} / 04</span>
                    <span className="text-fg-faint">·</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: p.color }}>
                      {p.code}
                    </span>
                  </div>
                  <div
                    className="flex size-9 items-center justify-center border border-border bg-bg font-mono text-base"
                    style={{ color: p.color }}
                  >
                    {p.glyph}
                  </div>
                </div>

                {/* Title + quote */}
                <div className="mt-6 flex flex-col gap-4">
                  <h3 className="font-display text-4xl leading-[0.95] tracking-tightest text-fg">
                    {p.title}
                  </h3>
                  <blockquote className="border-l-2 pl-3 font-display text-lg italic leading-snug text-fg-dim" style={{ borderColor: p.color }}>
                    "{p.quote}"
                  </blockquote>
                </div>

                {/* Pitch */}
                <p className="mt-6 max-w-[40ch] text-sm leading-relaxed text-fg-dim">
                  {p.pitch}
                </p>

                {/* Spark + stats */}
                <div className="mt-6 grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-7">
                    <div className="border border-border-soft bg-surface p-2">
                      <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                        <span>Learning curve</span>
                        <span style={{ color: p.color }}>+ live</span>
                      </div>
                      <div className="h-14">
                        <MiniSpark candles={candles} color={p.color} />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-5 grid grid-cols-3 gap-px bg-border-soft">
                    {p.stats.map((s) => (
                      <div key={s.k} className="bg-bg p-2">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint truncate">
                          {s.k}
                        </div>
                        <div className="mt-1 font-mono text-sm text-fg tabular-nums">{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tools */}
                <div className="mt-6 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint pr-1">
                    stack
                  </span>
                  {p.tools.map((t) => (
                    <span
                      key={t}
                      className="border border-border bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Bottom CTA */}
                <a
                  href="/trade"
                  className="mt-6 flex items-center justify-between border-t border-border-soft pt-4 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:text-fg"
                >
                  <span>Try this workspace →</span>
                  <span style={{ color: p.color }}>{p.code}</span>
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
