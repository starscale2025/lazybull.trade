import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "The Graveyard — lazybull",
  description: "Components that didn't make it. We delete our dead code and we bury it honestly.",
};

// THE GRAVEYARD — the headstone the exorcism earned. When the tribunal found
// ~1,900 lines of dead components shipped in the bundle, we deleted them
// (Phoenix Protocol Phase 0). Instead of pretending they never existed, we
// buried them here — name, line count, and an honest epitaph. Radical honesty
// is the brand; a cemetery for our own mistakes is the most on-brand page we
// could build. Line counts are exact (git show b2df7c1 --stat).

type Grave = { name: string; lines: number; born: string; epitaph: string };

const FALLEN: Grave[] = [
  { name: "CrystalHero.tsx", lines: 129, born: "the landing hero, once", epitaph: "Claimed to be three.js. Was a static webp. Never mounted." },
  { name: "SocialProof.tsx", lines: 140, born: "the trust band", epitaph: "Still believed in a $100,000 paper account long after we moved to five." },
  { name: "Hero.tsx", lines: 315, born: "the original front door", epitaph: "The first hero we ever wrote. The scroll-cinema took its job." },
  { name: "TradeOverview.tsx", lines: 369, born: "a second /trade", epitaph: "369 lines re-explaining a page that already explained itself." },
  { name: "UseCases.tsx", lines: 215, born: "three personas", epitaph: "The day trader, the student, the quant — read like a template because they were one." },
  { name: "Partners.tsx", lines: 119, born: "a logo wall", epitaph: "Logos of partners who had not, in fact, partnered." },
  { name: "LearnGreekSurface.tsx", lines: 254, born: "§06's flat greek plot", epitaph: "A fine 2D chart. Then §06 grew a third dimension you can orbit, and flat wasn't enough." },
  { name: "ScrollScrub.tsx", lines: 220, born: "§00.5, the prism film", epitaph: "A 300vh scroll-scrubbed prism. Pretty. It stood between you and the lesson, so it went." },
];

const total = FALLEN.reduce((a, g) => a + g.lines, 0);

export default function Graveyard() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-16">
        <div className="text-center">
          <div className="t-eyebrow text-fg-faint">⚰ here lie the fallen</div>
          <h1 className="mt-3 t-title">
            The Graveyard
          </h1>
          <p className="mx-auto mt-4 max-w-[54ch] font-mono text-[12px] leading-relaxed text-fg-dim">
            We delete our dead code. Most teams let it rot in the bundle — the audit found{" "}
            <span className="text-fg">{total.toLocaleString()} lines</span> of components that shipped to every
            visitor and rendered for none. We buried them. Honestly.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {FALLEN.map((g) => (
            <div
              key={g.name}
              className="group relative border border-border bg-surface/60 px-5 pb-6 pt-8 text-center transition-colors hover:border-fg-dim"
              style={{ borderTopLeftRadius: "50% 22px", borderTopRightRadius: "50% 22px" }}
            >
              <div className="t-eyebrow text-fg-faint">R.I.P.</div>
              <div className="mt-2 font-mono text-[13px] text-fg">{g.name}</div>
              <div className="mt-1 t-chrome text-bear">
                {g.lines} lines · deleted
              </div>
              <div className="mx-auto mt-3 h-px w-10 bg-border" />
              <div className="mt-3 t-chrome text-fg-faint">{g.born}</div>
              <p className="mt-2 font-mono text-[11px] italic leading-relaxed text-fg-dim">“{g.epitaph}”</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[11px] leading-relaxed text-fg-faint">
          Plus six more swept in the durability pass — ProCta, IntroSequence, MaterialHero,
          ParticleCurtain, SectionDivider, TerminalTilt (523 lines) — atmosphere that never
          made the cut.
        </p>

        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-fg-faint">
          And four rails retired when /learn became the Desk — SectionIndex, ScrollProgressBar,
          LiveBadge, DataStreamRail (237 lines) — seven decorative systems folded into one
          named navigator.
        </p>

        <div className="mt-8 border-t border-border-soft pt-6 text-center t-eyebrow text-fg-faint">
          scripts/guard.mjs watches the gate now · nothing dead ships again
        </div>
      </main>
      <Footer />
    </div>
  );
}
