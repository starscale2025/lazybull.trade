import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/calm/kit";

export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/graveyard" },
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
  { name: "CrystalHero.tsx", lines: 129, born: "The landing hero, once", epitaph: "Claimed to be three.js. Was a static webp. Never mounted." },
  { name: "SocialProof.tsx", lines: 140, born: "The trust band", epitaph: "Still believed in a $100,000 paper account long after we moved to five." },
  { name: "Hero.tsx", lines: 315, born: "The original front door", epitaph: "The first hero we ever wrote. The scroll-cinema took its job." },
  { name: "TradeOverview.tsx", lines: 369, born: "A second /trade", epitaph: "369 lines re-explaining a page that already explained itself." },
  { name: "UseCases.tsx", lines: 215, born: "Three personas", epitaph: "The day trader, the student, the quant — read like a template because they were one." },
  { name: "Partners.tsx", lines: 119, born: "A logo wall", epitaph: "Logos of partners who had not, in fact, partnered." },
  { name: "LearnGreekSurface.tsx", lines: 254, born: "§06’s flat greek plot", epitaph: "A fine 2D chart. Then §06 grew a third dimension you can orbit, and flat wasn’t enough." },
  { name: "ScrollScrub.tsx", lines: 220, born: "§00.5, the prism film", epitaph: "A 300vh scroll-scrubbed prism. Pretty. It stood between you and the lesson, so it went." },
];

const total = FALLEN.reduce((a, g) => a + g.lines, 0);

export default function Graveyard() {
  return (
    <div className="page-aura flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <main className="flex-1">
        <PageHeader
          eyebrow="Here lie the fallen"
          title="The Graveyard"
          lede={
            <>
              We delete our dead code. Most teams let it rot in the bundle — the audit found{" "}
              <span className="text-fg">{total.toLocaleString()} lines</span> of components that shipped to every
              visitor and rendered for none. We buried them. Honestly.
            </>
          }
        />

        <div className="shell pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FALLEN.map((g) => (
              <div
                key={g.name}
                className="calm-panel px-5 pb-6 pt-8 text-center"
                style={{ borderTopLeftRadius: "50% 22px", borderTopRightRadius: "50% 22px" }}
              >
                <i aria-hidden className="lit-aura" />
                <div className="t-eyebrow text-fg-faint">R.I.P.</div>
                <div className="mt-2 font-mono text-[0.8125rem] text-fg">{g.name}</div>
                <div className="mt-1 t-label text-fg-dim">{g.lines} lines · deleted</div>
                <div className="mt-4 t-label text-fg-faint">{g.born}</div>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-fg-dim">“{g.epitaph}”</p>
              </div>
            ))}
          </div>

          <details className="group measure-wide mt-10">
            <summary className="cursor-pointer list-none text-[0.875rem] text-fg-dim transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
              +10 more buried in later passes · 760 lines{" "}
              <span className="inline-block transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="mt-3 space-y-3 text-[0.8125rem] leading-relaxed text-fg-faint">
              <p>
                Six swept in the durability pass — ProCta, IntroSequence, MaterialHero, ParticleCurtain,
                SectionDivider, TerminalTilt (523 lines) — atmosphere that never made the cut.
              </p>
              <p>
                Four rails retired when /learn became the Desk — SectionIndex, ScrollProgressBar, LiveBadge,
                DataStreamRail (237 lines) — seven decorative systems folded into one named navigator.
              </p>
            </div>
          </details>

          <div className="mt-8 t-label text-fg-faint">
            scripts/guard.mjs watches the gate now · nothing dead ships again
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
