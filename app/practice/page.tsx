import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PracticeHero } from "@/components/practice/PracticeHero";
import { TrackCards } from "@/components/practice/TrackCards";
import { ProblemBoard } from "@/components/practice/ProblemBoard";
import { PracticeRail } from "@/components/practice/PracticeRail";
import { PracticeHow } from "@/components/practice/PracticeHow";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/practice" },
  title: "Practice — lazybull",
  description:
    "48 problems across finance, quant, ML, maths and trading. Solve, run, submit — on paper, for free.",
};

// The deck's Quant Playground (slide 7), as a page: the headline and today's
// problem, the figures, the five tracks as one ruled row, the problem set
// beside the learner's streak and progress, and how a problem is judged.
// `.deck` turns on the pitch deck's palette for everything inside.
export default function PracticePage() {
  return (
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <PracticeHero />
      <TrackCards />
      <section id="problems" aria-labelledby="problems-title" className="shell mt-[clamp(4rem,8vw,6.5rem)] scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="deck-eyebrow">Problem set</p>
            <h2 id="problems-title" className="deck-h2 mt-4 text-fg">
              Every problem, <span className="deck-accent">in one list</span>
            </h2>
          </div>
          <p className="max-w-[26rem] text-[0.9375rem] leading-relaxed text-fg-dim">
            Filter by track, level or where you left off, or press <kbd className="deck-kbd">⌘K</kbd> and ask for a random
            unsolved one.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
          <div className="min-w-0">
            <ProblemBoard />
          </div>
          <PracticeRail />
        </div>
      </section>
      <PracticeHow />
      <Footer marketing />
    </main>
  );
}
