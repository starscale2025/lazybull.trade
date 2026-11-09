import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink, PageHeader, Stats } from "@/components/calm/kit";
import { TrackGlyph } from "@/components/practice/Chips";
import { TrackAside, TrackPath, TrackStartLink } from "@/components/practice/TrackPath";
import { problemsByTrack, trackStats } from "@/lib/practice/problems";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";
import type { TrackId } from "@/lib/practice/types";

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

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!isTrack(track)) notFound();

  const meta = TRACK_META[track];
  const problems = problemsByTrack(track);
  const stats = trackStats(track);
  const first = problems[0];

  return (
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />

      {/* The eyebrow is the way back to the set, and carries the track's glyph. */}
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2.5">
            <TrackGlyph track={track} size="sm" />
            <Link href="/practice" className="transition-colors hover:text-fg">
              Practice
            </Link>
          </span>
        }
        title={`${meta.label}.`}
        accent="In order."
        lede={meta.blurb}
        actions={
          <>
            {first && (
              <TrackStartLink track={track} fallback={first.id}>
                Start next
              </TrackStartLink>
            )}
            <CalmLink href="/learn">Read the theory</CalmLink>
          </>
        }
      >
        <Stats
          className="mt-12"
          items={[
            { value: String(stats.total), label: "problems" },
            { value: `~${stats.hours} h`, label: "estimated" },
            { value: String(stats.byDifficulty.easy), label: "easy" },
            { value: String(stats.byDifficulty.medium), label: "medium" },
            { value: String(stats.byDifficulty.hard), label: "hard" },
          ]}
        />
        <p className="mt-6 text-[0.8125rem] text-fg-faint">Paper only · educational · not advice</p>
      </PageHeader>

      <section className="shell pb-16">
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <TrackPath track={track} problems={problems} />
          <TrackAside track={track} />
        </div>
      </section>

      <Footer marketing />
    </main>
  );
}
