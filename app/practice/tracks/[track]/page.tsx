import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
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
    <main className="tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* Breadcrumb — app/learn/bots/[id]/page.tsx lines 54-62 */}
      <section className="bg-bg">
        <div className="shell flex items-center gap-2 py-2 t-chrome text-fg-faint">
          <Link href="/practice" className="hover:text-fg">
            Practice
          </Link>
          <span>/</span>
          <span className="text-fg">{meta.label}</span>
        </div>
      </section>

      {/* Hero — the tinted blur-circle hero from app/learn/bots/[id]/page.tsx
          lines 64-119. The track colour is a CSS var, so the tint goes through
          color-mix rather than the hex-suffix trick the bot page uses. */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div
          className="pointer-events-none absolute -left-40 top-0 h-[26.25rem] w-[26.25rem] rounded-full blur-[160px]"
          style={{ background: `color-mix(in srgb, ${meta.color} 20%, transparent)` }}
        />
        <div className="relative shell section-y-sm">
          <div className="flex flex-col gap-6">
            <div className="flex items-end gap-5">
              <TrackGlyph track={track} size="lg" />
              <div>
                <h1 className="t-title text-fg">
                  {meta.label}. <span className="t-accent">In order.</span>
                </h1>
                <p className="mt-2 max-w-[58ch] t-body text-fg-dim">{meta.blurb}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 t-data t-chrome text-fg-faint">
              <span>{stats.total} problems</span>
              <span aria-hidden>·</span>
              <span>~{stats.hours}h</span>
              <span aria-hidden>·</span>
              <span className="text-bull">{stats.byDifficulty.easy} easy</span>
              <span aria-hidden>·</span>
              <span className="text-amber">{stats.byDifficulty.medium} medium</span>
              <span aria-hidden>·</span>
              <span className="text-bear">{stats.byDifficulty.hard} hard</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {first && (
                <TrackStartLink
                  track={track}
                  fallback={first.id}
                  className="inline-flex items-center gap-2 bg-bull px-4 py-2.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
                >
                  start next →
                </TrackStartLink>
              )}
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 surface-card border border-border bg-surface px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim hover:border-bull hover:text-bull"
              >
                ↗ read the theory
              </Link>
            </div>

            <div className="t-chrome text-fg-faint">paper only · educational · not advice</div>
          </div>
        </div>
      </section>

      <section className="shell section-y-sm">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <TrackPath track={track} problems={problems} />
          <TrackAside track={track} />
        </div>
      </section>

      <Footer marketing />
    </main>
  );
}
