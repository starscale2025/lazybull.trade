import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PracticeHero } from "@/components/practice/PracticeHero";
import { TrackCards } from "@/components/practice/TrackCards";
import { ProblemBoard } from "@/components/practice/ProblemBoard";
import { PracticeRail } from "@/components/practice/PracticeRail";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/practice" },
  title: "Practice — lazybull",
  description:
    "48 problems across finance, quant, ML, maths and trading. Solve, run, submit — on paper, for free.",
};

// Shell copied from app/quant/page.tsx. The body is a two-column grid from lg:
// cards + table on the left, the sticky rail on the right.
export default function PracticePage() {
  return (
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      {/* No ticker tape here since the calm pass (S1): a practice page has no
          market on it, and the tape was the loudest thing above the header. */}
      <Nav />
      <PracticeHero />
      <section className="shell pb-16">
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <TrackCards />
            <ProblemBoard />
          </div>
          <PracticeRail />
        </div>
      </section>
      <Footer marketing />
    </main>
  );
}
