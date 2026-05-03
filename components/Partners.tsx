type Partner = { name: string; type: string; mark: React.ReactNode };

const PARTNERS: Partner[] = [
  {
    name: "POLYGON.IO",
    type: "Market data",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <polygon points="16,4 28,11 28,21 16,28 4,21 4,11" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    name: "ALPACA",
    type: "Paper exec",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <path d="M6 26V10l6-4 6 4v16M18 14h6l4 4v8H18" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    name: "OPENAI",
    type: "Teacher LLM",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="16" cy="16" r="4" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "VERCEL",
    type: "Hosting",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <polygon points="16,4 28,26 4,26" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "TRADIER",
    type: "Real chain",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <path d="M4 24l8-16 4 8 4-4 8 12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="12" cy="8" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "TASTYTRADE",
    type: "Education",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <rect x="4" y="6" width="24" height="20" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 14h16M8 18h12M8 22h8" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    name: "OIC",
    type: "Curriculum",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M10 22l6-12 6 12M12 18h8" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    name: "INTERACTIVE",
    type: "Future broker",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <path d="M4 16h24M16 4v24" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    name: "CBOE",
    type: "Reference data",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <polygon points="16,4 28,12 24,28 8,28 4,12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="16" cy="18" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "FIGMA",
    type: "Design system",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <circle cx="20" cy="16" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="12" cy="24" r="4" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "SUPABASE",
    type: "Account data",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <path d="M16 4l10 14H6z" fill="currentColor" />
        <path d="M16 28l-10-14h20z" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    name: "POSTHOG",
    type: "Learning analytics",
    mark: (
      <svg viewBox="0 0 32 32" className="size-6">
        <rect x="6" y="6" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M10 22l4-6 4 4 6-8" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
];

function LogoCell({ p }: { p: Partner }) {
  return (
    <div className="group flex h-20 shrink-0 items-center gap-3 border-r border-border-soft px-8">
      <span className="text-fg-faint transition-colors group-hover:text-bull">{p.mark}</span>
      <div className="flex flex-col">
        <span className="font-display text-lg leading-none text-fg-dim transition-colors group-hover:text-fg tracking-tightest">
          {p.name}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          {p.type}
        </span>
      </div>
    </div>
  );
}

export function Partners() {
  return (
    <section className="relative border-b border-border bg-bg-soft">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      <div className="relative mx-auto max-w-[1400px] px-5 pt-24 pb-12">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ Section 05 / Stack
            </span>
            <span className="font-mono text-[11px] text-bull">// partners.json</span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <h2 className="font-display text-[clamp(2.5rem,6vw,5.6rem)] leading-[0.92] tracking-tightest text-fg">
              Standing on the shoulders
              <br />
              <span className="italic font-light text-fg-dim">
                of the <span className="text-bull not-italic font-normal">people who built it right</span>.
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Network grid stat header */}
      <div className="relative mx-auto max-w-[1400px] px-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
          {[
            { v: "12", k: "Stack partners" },
            { v: "100%", k: "Open standards" },
            { v: "0", k: "Real money handled" },
            { v: "SOC2", k: "On the roadmap" },
          ].map((s) => (
            <div key={s.k} className="bg-bg p-5">
              <div className="font-display text-3xl tracking-tightest text-fg">{s.v}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee rows */}
      <div className="relative mt-12 overflow-hidden border-y border-border bg-bg">
        <div className="flex marquee w-max">
          {[...PARTNERS, ...PARTNERS].map((p, i) => (
            <LogoCell key={`row1-${i}`} p={p} />
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden border-b border-border bg-bg-soft">
        <div className="flex marquee-reverse w-max">
          {[...PARTNERS.slice().reverse(), ...PARTNERS.slice().reverse()].map((p, i) => (
            <LogoCell key={`row2-${i}`} p={p} />
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-20 pt-12">
        <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {[
            { t: "Paper-only beta", d: "No real funds. No broker connection. Yet.", icon: "◼" },
            { t: "Default-on safety", d: "Risk wizard, training wheels, kill switch — for everyone.", icon: "◆" },
            { t: "Educational use", d: "Built for individuals and classrooms learning options.", icon: "▲" },
          ].map((b) => (
            <div key={b.t} className="flex items-center gap-4 bg-bg p-5">
              <span className="font-mono text-2xl text-bull">{b.icon}</span>
              <div>
                <div className="font-mono text-sm uppercase tracking-wider text-fg">{b.t}</div>
                <div className="font-mono text-[11px] text-fg-dim">{b.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
