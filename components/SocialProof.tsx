import { generateCandles } from "@/lib/candles";
import { MiniSpark } from "./CandleChart";

const TESTIMONIALS = [
  {
    quote:
      "I'd been afraid of options for ten years. Built my first iron condor in three drags and the AI teacher walked me through the loss tail before I even hit paper-trade.",
    name: "Marcus Cole",
    handle: "@marcuscole",
    role: "Software engineer · learning options",
    kpi: { k: "First trade", v: "4 min", c: "var(--bull)" },
    seed: 12,
    drift: 0.16,
  },
  {
    quote:
      "The Greeks finally clicked when I saw Delta walking and Theta melting. I've been trading for three years and this is the first time the visual matched the math.",
    name: "Anya Roshanak",
    handle: "@anyaR",
    role: "Active trader · 3yrs in",
    kpi: { k: "Greek explainers", v: "all 6", c: "var(--cyan)" },
    seed: 88,
    drift: 0.09,
  },
  {
    quote:
      "I run a small options Discord. I sent everyone a link to the visual chain and our beginner channel went silent for a week. They were just learning.",
    name: "Yuki Tanaka",
    handle: "@yukiquant",
    role: "Community owner · 2,400 members",
    kpi: { k: "New learners", v: "+340", c: "var(--plasma)" },
    seed: 41,
    drift: 0.22,
  },
  {
    quote:
      "Training-wheels mode is genuinely the feature I wanted from a broker for ten years. Defined-risk only, daily limit, kill switch. Should be the default everywhere.",
    name: "Diego Marín",
    handle: "@dmarin",
    role: "Self-taught · day-job dad",
    kpi: { k: "Loss limit", v: "$300/d", c: "var(--bull)" },
    seed: 7,
    drift: 0.13,
  },
  {
    quote:
      "I teach a finance elective at a community college. We use LAZYBULL the entire spreads & condors module. The students get it. They also no longer try to YOLO calls.",
    name: "Priya Chandrashekar",
    handle: "@priyat",
    role: "Educator · finance instructor",
    kpi: { k: "Cohort", v: "32 students", c: "var(--amber)" },
    seed: 55,
    drift: 0.07,
  },
];

export function SocialProof() {
  return (
    <section className="relative border-b border-border bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />

      {/* Header */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-24 pb-12">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ Section 04 / Receipts
            </span>
            <span className="font-mono text-[11px] text-bull">// learners.log</span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-[clamp(2.5rem,6vw,5.6rem)] leading-[0.92] tracking-tightest text-fg">
              People who get options now.
              <br />
              <span className="italic font-light text-fg-dim">
                Because they finally{" "}
                <span className="text-bull not-italic font-normal">saw</span> them.
              </span>
            </h2>
          </div>
        </div>

        {/* Big proof numbers */}
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
          {[
            { v: "32k+", k: "Beta learners", c: "text-fg" },
            { v: "240k", k: "Strategies built", c: "text-fg" },
            { v: "4 min", k: "Median time-to-first-trade", c: "text-bull" },
            { v: "0", k: "Real dollars at risk", c: "text-amber" },
          ].map((s) => (
            <div key={s.k} className="bg-bg p-6">
              <div className={`font-display text-5xl tracking-tightest ${s.c}`}>{s.v}</div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials — bento layout */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-24">
        <div className="grid grid-cols-12 gap-px bg-border">
          {TESTIMONIALS.map((t, i) => {
            const candles = generateCandles(24, t.seed, 100, t.drift, 1.4);
            const layouts = [
              "col-span-12 md:col-span-6 lg:col-span-7",
              "col-span-12 md:col-span-6 lg:col-span-5",
              "col-span-12 md:col-span-6 lg:col-span-4",
              "col-span-12 md:col-span-6 lg:col-span-4",
              "col-span-12 lg:col-span-4",
            ];
            const isLarge = i === 0;
            return (
              <article
                key={t.handle}
                className={`group relative flex flex-col gap-6 bg-bg p-6 transition-colors hover:bg-surface md:p-8 ${layouts[i]}`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                    Verified learner
                    <span className="text-fg-faint">·</span>
                    <span>seat #{(i + 1) * 4719}</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    {String(i + 1).padStart(2, "0")}/{TESTIMONIALS.length}
                  </span>
                </div>

                {/* Quote */}
                <blockquote
                  className={`font-display tracking-tightest text-fg ${
                    isLarge ? "text-3xl md:text-4xl leading-[1.05]" : "text-xl md:text-2xl leading-[1.15]"
                  }`}
                >
                  <span className="text-bull">"</span>
                  {t.quote}
                  <span className="text-bull">"</span>
                </blockquote>

                {/* Footer */}
                <div className="mt-auto grid grid-cols-12 items-end gap-3 border-t border-border-soft pt-4">
                  <div className="col-span-12 sm:col-span-7 flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center border border-border bg-surface font-display text-base text-fg"
                      style={{ borderColor: t.kpi.c }}
                    >
                      {t.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-fg truncate">{t.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim truncate">
                        {t.role}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-5 flex items-end justify-end gap-3">
                    <div className="text-right">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                        {t.kpi.k}
                      </div>
                      <div className="font-mono text-base tabular-nums" style={{ color: t.kpi.c }}>
                        {t.kpi.v}
                      </div>
                    </div>
                    <div className="h-10 w-24 shrink-0">
                      <MiniSpark candles={candles} color={t.kpi.c} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* CTA — massive */}
        <div className="relative mt-px overflow-hidden border border-border bg-bg-soft">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="pointer-events-none absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-bull/15 blur-[120px] drift" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-amber/10 blur-[120px] drift" style={{ animationDelay: "-9s" }} />

          {/* tape header */}
          <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
            <span>OPEN BETA · NO CARD · PAPER ONLY</span>
            <span>WAITLIST CLEARED 04/03</span>
          </div>

          <div className="relative grid grid-cols-12 items-center gap-x-5 gap-y-8 px-5 py-16 md:py-24">
            <div className="col-span-12 lg:col-span-8">
              <h3 className="font-display text-[clamp(3rem,7vw,7rem)] leading-[0.86] tracking-tightest text-fg">
                Stop guessing at options.
                <br />
                <span className="italic font-light text-bull phosphor">See</span> them.
              </h3>
              <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-fg-dim md:text-lg">
                Open the visual chain. Drag two cells. Hover a Greek. The teacher
                does the rest. Free, paper-only, training wheels on by default —
                no card, no broker setup, no way to lose real money.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
              <a
                href="/trade"
                className="group relative inline-flex items-center justify-between border border-bull bg-bull px-6 py-5 font-mono text-sm font-semibold uppercase tracking-wider text-bg"
              >
                <span className="flex items-center gap-3">
                  <span className="size-2 rounded-full bg-bg pulse-dot" />
                  Open the chain
                </span>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-between border border-border bg-bg px-6 py-5 font-mono text-sm font-semibold uppercase tracking-wider text-fg transition-colors hover:border-fg-dim"
              >
                <span>Read the safety manifesto</span>
                <span className="text-fg-faint">→</span>
              </a>
              <div className="mt-2 grid grid-cols-3 gap-3 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <div>
                  <div className="text-fg">Paper $100k</div>
                  <div className="text-fg-faint">to start</div>
                </div>
                <div>
                  <div className="text-fg">No card</div>
                  <div className="text-fg-faint">required</div>
                </div>
                <div>
                  <div className="text-fg">Kill switch</div>
                  <div className="text-fg-faint">on</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
