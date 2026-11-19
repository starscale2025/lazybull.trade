import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TrackGlyph } from "@/components/practice/Chips";
import { TrackAside, TrackPath, TrackStartLink } from "@/components/practice/TrackPath";
import { problemsByTrack, trackStats } from "@/lib/practice/problems";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";
import type { Difficulty, TrackId } from "@/lib/practice/types";

// Five static pages, one per track; anything else under /practice/tracks/ is a
// 404 at the router rather than a rendered empty page.
export function generateStaticParams() {
  return TRACK_ORDER.map((track) => ({ track }));
}
export const dynamicParams = false;

function isTrack(value: string): value is TrackId {
  return value in TRACK_META;
}

export async function generateMetadata({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) return { title: "Track not found · lazybull" };
  const meta = TRACK_META[track];
  return {
    title: `${meta.label} track · Practice · lazybull`,
    description: meta.blurb,
    // Per-route canonical, as every sibling: without it the five track pages
    // inherit the root canonical and read as copies of the homepage.
    alternates: { canonical: `/practice/tracks/${track}` },
  };
}

const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;
const LEVELS: Difficulty[] = ["easy", "medium", "hard"];

/** The deck's figure (slide 2): light-italic serif, a label over it. */
const FIGURE = "deck-figure text-[clamp(2.5rem,4.6vw,3.75rem)] text-fg";
const LINE = "text-[0.875rem] leading-snug text-fg-dim";

// The page in the pitch deck's hand (2026-11-17): the /practice header — a
// green-dot eyebrow that is also the way back to the set, the title in
// Fraunces with its one green italic phrase, the track's glyph on the deck's
// tile beside it — then the deck's figure row and, under it, the path and the
// aside. `.deck` on <main> turns the deck's palette on for all of it.
export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) notFound();

  const meta = TRACK_META[track];
  const problems = problemsByTrack(track);
  const stats = trackStats(track);
  const first = problems[0];

  return (
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />

      <header className="shell pb-10 pt-[clamp(3rem,7vw,5.5rem)]">
        <p className="deck-eyebrow deck-rise">
          <Link href="/practice" className="transition-colors hover:text-fg">
            Practice
          </Link>
          <span aria-hidden>·</span>
          <span>Track</span>
        </p>
        <div className="deck-rise mt-5 flex items-start gap-4 sm:gap-6" style={at(1)}>
          <TrackGlyph track={track} size="lg" className="mt-1 lg:mt-2" />
          <h1 className="deck-h1 min-w-0 max-w-[20ch] text-fg">
            {meta.label}. <span className="deck-accent">In order.</span>
          </h1>
        </div>
        <p className="deck-lede deck-rise mt-6 max-w-[38rem]" style={at(2)}>
          {meta.blurb}
        </p>
        <div className="deck-rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" style={at(3)}>
          {first && (
            <TrackStartLink track={track} fallback={first.id}>
              Start next
            </TrackStartLink>
          )}
          <Link href="/learn" className="deck-link">
            Read the theory
            <span aria-hidden className="deck-arrow">
              →
            </span>
          </Link>
        </div>

        {/* The figures, the deck's way: a mono label, the numeral, one line —
            columns ruled by hairlines under the stronger rule. */}
        <dl
          className="deck-rise mt-[clamp(2.75rem,5.5vw,4rem)] grid grid-cols-2 border-t border-[var(--deck-rule)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]"
          style={at(4)}
        >
          <div className="flex flex-col gap-3 py-6 pr-4">
            <dt className="deck-label">Problems</dt>
            <dd className={FIGURE}>{stats.total}</dd>
            <dd className={LINE}>in this track, in order</dd>
          </div>
          <div className="flex flex-col gap-3 border-l border-border py-6 pl-5 pr-4 lg:pl-6">
            <dt className="deck-label">Estimated</dt>
            <dd className={FIGURE}>
              ~{stats.hours}
              <span className="ml-1.5 font-sans text-[0.9375rem] not-italic text-fg-faint">h</span>
            </dd>
            <dd className={LINE}>summed from each problem’s minutes</dd>
          </div>
          <div className="col-span-2 flex flex-col gap-3 border-t border-border py-6 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-6">
            <dt className="deck-label">By level</dt>
            <dd className="flex flex-wrap gap-x-10 gap-y-4">
              {LEVELS.map((d) => (
                <span key={d} className="flex flex-col gap-3">
                  <span className={FIGURE}>{stats.byDifficulty[d]}</span>
                  <span className={LINE}>{d}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <p className="deck-rise border-t border-border pt-4 font-mono text-[0.75rem] tracking-[0.04em] text-fg-faint" style={at(5)}>
          Paper only · educational · not advice
        </p>
      </header>

      <section className="shell pb-[clamp(4rem,8vw,6rem)]">
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
          <TrackPath track={track} problems={problems} />
          <TrackAside track={track} />
        </div>
      </section>

      <Footer marketing />
    </main>
  );
}
