import { CountUp } from "./atmosphere/CountUp";

/**
 * "Receipts" section — but honest. We're pre-launch and have no testimonials
 * to fairly cite, so the section says exactly that. The single defensible
 * brand promise ("$0 real dollars at risk, ever") becomes the headline stat.
 */

const PROMISES = [
  { t: "Paper-only", d: "We never touch real funds. The site can't take real funds." },
  { t: "Defined-risk by default", d: "Naked shorts and unbounded loss tails are off until you turn them on, with a 3-second cooldown and a confirmation that names the worst case." },
  { t: "Daily kill switch", d: "Hit your daily loss cap, every open paper position auto-closes. Reset tomorrow." },
  { t: "Plain-English first", d: "Every Greek and every strategy has a one-sentence explanation written for a twelve-year-old, not a CFA." },
];

export function SocialProof() {
  return (
    <section className="relative border-b border-border bg-bg">
      {/* Header */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-20 pb-12">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 md:col-span-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
              the promise
            </span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-[clamp(2rem,4vw,3.6rem)] leading-[1.05] tracking-tightest text-fg">
              We're pre-launch — so
              <br />
              <span className="italic font-light text-fg-dim">
                no testimonials, just promises.
              </span>
            </h2>
          </div>
        </div>

        {/* The single defensible number — the brand promise itself */}
        <div
          data-gsap="stagger"
          data-gsap-duration="1.0"
          className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-3"
        >
          <div className="bg-bg p-8 md:col-span-2 md:p-10">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
              real dollars at risk · since launch · forever
            </div>
            <div className="mt-3 font-display text-[clamp(5rem,12vw,11rem)] leading-[0.9] tracking-tightest tabular-nums text-fg">
              <CountUp to={0} duration={1200} />
            </div>
            <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-fg-dim">
              We are not a broker. We do not accept funds. The fastest you can
              lose money on LAZYBULL is by closing the tab and missing lunch.
            </p>
          </div>
          <div className="grid grid-cols-1 bg-bg">
            {[
              { k: "Paper balance", v: "$100,000" },
              { k: "Strategies covered", v: "14+" },
              { k: "Greeks explained", v: "6 / 6" },
            ].map((s) => (
              <div key={s.k} className="border-b border-border-soft p-6 last:border-b-0">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  {s.k}
                </div>
                <div className="mt-1 font-display text-3xl tracking-tightest text-fg tabular-nums">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The four promises — replaces fake testimonials */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-20">
        <div className="mb-8 flex items-end justify-between">
          <h3 className="font-display text-2xl tracking-tightest text-fg">
            What we'll defend instead of receipts.
          </h3>
          <span className="hidden md:inline font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            04 commitments
          </span>
        </div>
        <div
          data-gsap="stagger-fast"
          data-gsap-duration="1.0"
          className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-2"
        >
          {PROMISES.map((p, i) => (
            <article key={p.t} className="group relative bg-bg p-6 transition-colors hover:bg-surface md:p-8">
              <div className="flex items-baseline gap-3 border-b border-border-soft pb-3">
                <span className="font-mono text-sm tabular-nums text-fg">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h4 className="mt-4 font-display text-2xl tracking-tightest text-fg">
                {p.t}
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-fg-dim">
                {p.d}
              </p>
            </article>
          ))}
        </div>

        {/* Final CTA — quieter, fg-fill, single button */}
        <div className="relative mt-16 overflow-hidden border border-border bg-bg-soft">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-bull/8 blur-[120px] drift" />
          <div className="relative grid grid-cols-12 items-center gap-x-5 gap-y-8 px-5 py-16 md:py-20">
            <div className="col-span-12 lg:col-span-8">
              <h3 className="font-display text-[clamp(3rem,8vw,8rem)] leading-[0.86] tracking-tightest text-fg">
                Open.
              </h3>
              <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-fg-dim md:text-lg">
                Free, paper-only, training wheels on by default — no card, no
                broker setup, no way to lose real money.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <a
                href="/trade"
                className="group relative inline-flex w-full items-center justify-between border border-fg bg-fg px-6 py-5 font-mono text-sm font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bg hover:text-fg"
              >
                <span>Drag something →</span>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </a>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                no card · paper $100k · kill switch on
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
