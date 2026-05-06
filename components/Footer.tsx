const COLS = [
  {
    title: "Product",
    links: ["Visual chain", "AI teacher", "Strategy detector", "Paper trading", "Safety wheels", "Roadmap"],
  },
  {
    title: "Learn",
    links: ["What's an option?", "Greeks 101", "Spreads 101", "Iron condors", "Glossary", "Worked examples"],
  },
  {
    title: "Build",
    links: ["Public API", "Strategy SDK", "Embeddable chain", "Webhooks", "Docs", "Changelog"],
  },
  {
    title: "About",
    links: ["Manifesto", "Safety", "Press", "Brand kit", "Contact", "Status"],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-bg">
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-full bg-bull/8 blur-[160px]" />

      {/* Top callout */}
      <div className="relative mx-auto max-w-[1400px] border-b border-border-soft px-5 py-12">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-8">
          <div className="col-span-12 lg:col-span-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint mb-4">
              ⟢ Last call
            </p>
            <h3 className="font-display text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.92] tracking-tightest text-fg">
              The chain is open.
              <br />
              <span className="italic font-light text-bull">Drag something.</span>
            </h3>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <form className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                One email a week · a single new strategy explained
              </label>
              <div className="flex border border-border bg-surface focus-within:border-bull">
                <span className="flex items-center px-3 font-mono text-sm text-bull">$</span>
                <input
                  type="email"
                  placeholder="learner@inbox.io"
                  className="flex-1 bg-transparent py-3.5 font-mono text-sm text-fg placeholder:text-fg-faint outline-none"
                />
                <button className="bg-fg px-5 font-mono text-xs font-semibold uppercase tracking-wider text-bg hover:bg-bull transition-colors">
                  Subscribe →
                </button>
              </div>
              <p className="font-mono text-[10px] text-fg-faint">
                no upsells. one strategy per email. unsubscribe with <span className="text-bull">/quit</span>.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Massive wordmark — the italic-light "bull" with a gradient applied
          via background-clip: text WILL clip its rightward italic overhang
          unless the inline box explicitly extends past the glyph. The fix
          stack:
            • inline-block on the italic span so padding takes effect
            • padding-right: 0.22em — extends the gradient region past the
              second 'l's slanted top-right stroke
            • drop tracking-tightest (-0.05em letter-spacing) on the h2 — the
              negative spacing pulled the last 'l' inside its own box
            • margin-left on the period to clear the extended italic span */}
      <div className="relative mx-auto max-w-[1400px] overflow-visible px-5 pt-12">
        <h2
          aria-hidden
          data-gsap="reveal-clip"
          data-gsap-duration="1.6"
          className="select-none font-display leading-[0.82] text-fg"
          style={{
            fontSize: "clamp(4rem, 13vw, 13rem)",
            letterSpacing: "-0.02em",
            paddingRight: "0.3em",
            paddingBottom: "0.06em",
          }}
        >
          lazy
          <span
            className="italic font-light inline-block headline-sweep"
            style={{ paddingLeft: "0.04em", paddingRight: "0.22em" }}
          >
            bull
          </span>
          <span
            className="text-bull crt-flicker inline-block"
            style={{ marginLeft: "-0.08em" }}
          >
            .
          </span>
        </h2>
      </div>

      {/* Link columns */}
      <div
        data-gsap="stagger-fast"
        data-gsap-duration="0.8"
        className="relative mx-auto max-w-[1400px] grid grid-cols-2 gap-x-5 gap-y-10 px-5 py-16 md:grid-cols-6"
      >
        <div className="col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint mb-4">
            Manifesto
          </div>
          <p className="font-display text-base leading-snug text-fg-dim">
            Options shouldn't be a guessing game.
            <br />
            <span className="italic">Make them visible. Make them safe.</span>
          </p>
          <div className="mt-6 flex items-center gap-2">
            {["TW", "GH", "DC", "TG", "YT"].map((s) => (
              <a
                key={s}
                href="#"
                className="flex size-8 items-center justify-center border border-border bg-bg font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim transition-colors hover:border-bull hover:text-bull"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint mb-4">
              {col.title}
            </div>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="group inline-flex items-center gap-2 font-mono text-sm text-fg-dim transition-colors hover:text-fg"
                  >
                    <span className="text-fg-faint group-hover:text-bull">›</span>
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="relative border-t border-border bg-bg-soft">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          <div className="flex items-center gap-3">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span className="text-bull">paper-only beta · stable</span>
            <span className="text-fg-faint">·</span>
            <span>build a4f819 · v1.4.0</span>
            <span className="text-fg-faint hidden md:inline">·</span>
            <span className="hidden md:inline">region · iad-1</span>
          </div>
          <div className="flex items-center gap-3">
            <span>© 2026 lazybull labs</span>
            <span className="text-fg-faint">·</span>
            <a href="#" className="hover:text-fg">privacy</a>
            <span className="text-fg-faint">·</span>
            <a href="#" className="hover:text-fg">terms</a>
            <span className="text-fg-faint">·</span>
            <a href="#" className="hover:text-fg">safety</a>
          </div>
        </div>
      </div>

      {/* Disclaimer — confidently visible. Safety story is brand, not fine print. */}
      <div className="relative border-t border-border bg-bg">
        <p className="mx-auto max-w-[1400px] px-5 py-5 font-mono text-[11px] leading-relaxed text-fg-dim">
          LAZYBULL is an educational platform for learning about options. We do
          not accept real funds, are not a registered broker-dealer, and do not
          provide investment advice. Paper-trading results are simulated using
          delayed market data and a Black-Scholes pricing model. Real options
          trading involves substantial risk and is not suitable for every investor.
        </p>
      </div>
    </footer>
  );
}
