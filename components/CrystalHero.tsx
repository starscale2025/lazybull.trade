import Link from "next/link";
import { ScrollReveal } from "@/components/atmosphere/ScrollReveal";

// The ref-01 landing hero (docs/design-refs/01-hero.png), built exactly: serif
// headline stack left, crystal bull right, mono kicker, pill CTA, and the
// four-chip feature strip along the bottom. Sits directly after the cinema —
// signed-in visitors (who skip the intro) land here first.
const FEATURES = [
  {
    title: "Visual chain",
    desc: ["See every leg.", "Every number."],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <circle cx="5" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="19" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.6 15.6 10.4 10.6M13.9 9.9l3.2 2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Real-time pricing",
    desc: ["Options, stocks, futures.", "All in one flow."],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path d="M3 14l4-5 4 3 5-7 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="7" cy="9" r="1.4" fill="currentColor" />
        <circle cx="16" cy="5" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Paper trading",
    desc: ["Practice. Refine.", "Without risk."],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 11.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Quant-grade tools",
    desc: ["Built for edge.", "Designed to learn."],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <rect x="7" y="7" width="10" height="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function CrystalHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      {/* melt the cinema's black ending into this section — no hard seam */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40"
        style={{ background: "linear-gradient(to bottom, var(--bg) 0%, transparent 100%)" }}
      />

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-12 items-center gap-x-5 px-5 pt-10 lg:pt-16">
        {/* LEFT — the headline stack (reveals as the cinema hands off) */}
        <ScrollReveal as="div" speed="normal" className="col-span-12 pb-10 lg:col-span-5 lg:pb-16">
          <h1 className="font-display text-[clamp(3.4rem,7.5vw,6.5rem)] leading-[0.98] tracking-tightest text-fg">
            Learn it.
            <br />
            Backtest it.
            <br />
            Trade it
            <span className="text-bull">.</span>
          </h1>
          <p className="mt-7 font-mono text-[12px] uppercase tracking-[0.3em] text-fg-dim">
            Drag the trade. Watch the math. Paper-trade it.
          </p>
          <Link
            href="/trade"
            className="group mt-9 inline-flex h-14 items-center gap-3 rounded-full bg-bull px-10 font-mono text-[13px] font-bold uppercase tracking-wider text-bg transition-transform hover:scale-[1.02]"
          >
            Open the chain
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className="transition-transform group-hover:translate-x-1">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
        </ScrollReveal>

        {/* RIGHT — the crystal bull, standing on the void */}
        <ScrollReveal as="div" speed="slow" delay={150} className="relative col-span-12 lg:col-span-7">
          <img
            src="/media/bull/crystal-bull@1400.webp"
            alt="A charging bull carved from faceted black crystal, emerald energy glowing in its fracture seams"
            className="mx-auto w-full max-w-[760px] select-none object-contain"
            draggable={false}
          />
          {/* melt the image bounds into the void so it reads as a scene, not a box */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 62% 58% at 50% 52%, transparent 55%, var(--bg) 96%)" }}
          />
        </ScrollReveal>
      </div>

      {/* the feature strip */}
      <ScrollReveal as="div" speed="normal" delay={250} className="relative border-t border-border">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group flex items-start gap-4 bg-bg px-6 py-6 transition-colors hover:bg-surface">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-bull/40 text-bull">
                {f.icon}
              </span>
              <span>
                <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fg">
                  {f.title}
                </span>
                {f.desc.map((line) => (
                  <span key={line} className="block font-mono text-[11px] leading-relaxed text-fg-dim">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
