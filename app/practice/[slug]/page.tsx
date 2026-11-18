import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workspace, type Neighbour } from "@/components/practice/Workspace";
import { allProblems, forClient, getProblem } from "@/lib/practice/content";
import { problemFigure } from "@/components/practice/figures";

type Params = Promise<{ slug: string }>;

// Every problem that has both a registry row and authored content. The heavy
// content module is imported HERE, on the server, and only the current
// problem crosses the RSC boundary as a prop — through forClient, which strips
// the hidden cases, the editorial and the hints past the first, so the page
// payload cannot be read for answers (they travel later, through
// app/api/practice/[slug]/cases and .../editorial, behind their walls).
export function generateStaticParams() {
  return allProblems().map((p) => ({ slug: p.id }));
}

// Anything not in generateStaticParams is a 404 at the router — so an unknown
// slug never renders an empty workspace, and the reserved segments
// (profile · contest · tracks) keep their own pages.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) return { title: "Problem not found · Practice · lazybull" };
  return {
    title: `${problem.title} · Practice · lazybull`,
    description: problem.blurb,
    // Per-route canonical, as every sibling: without it the 48 problem pages
    // inherit the root's and tell Google they are copies of the homepage.
    alternates: { canonical: `/practice/${slug}` },
  };
}

/** Prev / next among the problems that HAVE content, in registry order.
    Identical to neighbours() in lib/practice/problems.ts once all 48 are
    authored; while the content files are still being generated it skips the
    gaps so the arrows never point at a 404. */
function neighboursWithContent(slug: string): { prev: Neighbour; next: Neighbour } {
  const all = allProblems();
  const i = all.findIndex((p) => p.id === slug);
  const pick = (p: (typeof all)[number] | undefined): Neighbour => (p ? { id: p.id, title: p.title } : null);
  return { prev: pick(all[i - 1]), next: pick(all[i + 1]) };
}

export default async function ProblemPage({ params }: { params: Params }) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();

  const { prev, next } = neighboursWithContent(slug);

  // Full-height IDE like /pro and /trade: the desk fills the viewport at lg
  // and the panes scroll inside themselves. No Footer on purpose. `deck` is
  // the pitch deck's skin (globals.css, THE DECK SKIN): the Playground
  // mockup on slide 7 is this screen. No site navbar either (owner,
  // 2026-11-17): the Workspace's own bar is the page's one bar — the wordmark
  // home, the Practice / subject / problem trail, prev and next.
  return (
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg text-fg lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <Workspace key={problem.id} problem={forClient(problem)} prev={prev} next={next} figure={problemFigure(problem)} />
    </main>
  );
}
