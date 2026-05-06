/**
 * "Built on" — honest stack only. The previous list ("INTERACTIVE / FIGMA /
 * POSTHOG / SUPABASE / TASTYTRADE / CBOE") was aspirational at best and
 * read as theater. This is the real list of what's actually wired up
 * today, with no marquee fanfare.
 */

type Stack = { name: string; type: string; mark: React.ReactNode };

const STACK: Stack[] = [
  {
    name: "Yahoo Finance",
    type: "Live spot prices",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <path d="M4 24l8-16 4 8 4-4 8 12" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    ),
  },
  {
    name: "OpenAI",
    type: "Plain-English teacher",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Black-Scholes",
    type: "Pricing engine · in-house",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <path d="M5 24c4-12 8-12 11 0s7 12 11 0" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    ),
  },
  {
    name: "Vercel",
    type: "Hosting",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <polygon points="16,5 27,25 5,25" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Next.js · 16",
    type: "App framework",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M11 10v12M11 10l10 12" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    name: "MongoDB",
    type: "Workspaces",
    mark: (
      <svg viewBox="0 0 32 32" className="size-5">
        <path d="M16 4c-2 8-2 14 0 24M16 4c2 8 2 14 0 24" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    ),
  },
];

export function Partners() {
  return (
    <section className="relative border-b border-border bg-bg-soft">
      <div className="relative mx-auto max-w-[1400px] px-5 pt-20 pb-20">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 md:col-span-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
              built on
            </span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-[clamp(1.8rem,3.4vw,3rem)] leading-[1.1] tracking-tightest text-fg">
              No partners. No deals.
              <br />
              <span className="italic font-light text-fg-dim">
                Just the things actually plugged in today.
              </span>
            </h2>
          </div>
        </div>

        <div
          data-gsap="stagger-fast"
          data-gsap-duration="0.9"
          className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 md:grid-cols-3"
        >
          {STACK.map((p) => (
            <div
              key={p.name}
              className="group flex items-center gap-4 bg-bg p-5 transition-colors hover:bg-surface"
            >
              <span className="text-fg-faint transition-colors group-hover:text-fg">{p.mark}</span>
              <div className="flex flex-col">
                <span className="font-display text-base text-fg tracking-tightest">{p.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  {p.type}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-[60ch] font-mono text-[11px] leading-relaxed text-fg-dim">
          Implied-volatility numbers shown on the site are synthetic — no free
          retail options-IV feed exists yet. Everything else above is real and
          wired.
        </p>
      </div>
    </section>
  );
}
