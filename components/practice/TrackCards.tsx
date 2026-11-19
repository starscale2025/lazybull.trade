"use client";

// The five tracks on /practice, set as the deck sets its seven disciplines
// (slide 3): one ruled row, a column per discipline, hairlines between. Each
// column is a link to its track: the glyph, the name in the display serif,
// the hint, and the learner's own progress through it. A client component
// because every column reads solved/total from the progress hook — its first
// render is the empty ledger, identical on the server and the client.

import Link from "next/link";
import { ProgressBar } from "@/components/practice/ProgressBar";
import { usePracticeProgress } from "@/lib/practice/progress";
import { PROBLEMS, trackStats } from "@/lib/practice/problems";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

export function TrackCards() {
  const { summary } = usePracticeProgress();
  const solvedAll = TRACK_ORDER.reduce((n, t) => n + summary.byTrack[t].solved, 0);

  return (
    <section id="tracks" aria-labelledby="tracks-title" className="shell mt-[clamp(4rem,8vw,6.5rem)] scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="deck-eyebrow">Tracks</p>
          <h2 id="tracks-title" className="deck-h2 mt-4 text-fg">
            Five tracks, <span className="deck-accent">from pricing to sizing</span>
          </h2>
        </div>
        <p className="deck-label">
          {solvedAll} of {PROBLEMS.length} solved
        </p>
      </div>

      <nav aria-label="Tracks" className="mt-8 grid grid-cols-1 border-t border-[var(--deck-rule)] sm:grid-cols-2 lg:grid-cols-5">
        {TRACK_ORDER.map((t, i) => {
          const meta = TRACK_META[t];
          const { solved, total } = summary.byTrack[t];
          const { hours } = trackStats(t);
          return (
            <Link
              key={t}
              href={`/practice/tracks/${t}`}
              className={`group relative flex flex-col border-b border-border py-6 transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_2.5%,transparent)] sm:pr-5 lg:border-b-0 ${
                i % 2 === 1 ? "sm:border-l sm:pl-5" : "sm:pl-0"
              } ${i > 0 ? "lg:border-l lg:pl-5" : ""} ${i === 4 ? "sm:col-span-2 lg:col-span-1" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span aria-hidden className="font-mono text-[1.125rem] text-bull">
                  {meta.glyph}
                </span>
                <span aria-hidden className="deck-arrow text-fg-faint transition-colors group-hover:text-bull">
                  →
                </span>
              </div>
              <h3 className="deck-display mt-5 text-[1.5rem] leading-none tracking-[-0.02em] text-fg">{meta.label}</h3>
              <p className="mt-2 text-[0.875rem] leading-snug text-fg-dim">
                {meta.hint.charAt(0).toUpperCase() + meta.hint.slice(1)}
              </p>
              <ProgressBar
                value={total > 0 ? solved / total : 0}
                color="var(--bull)"
                className="mt-6"
                ariaLabel={`${meta.label}: ${solved} of ${total} solved`}
              />
              <p className="mt-2.5 font-mono text-[0.6875rem] tabular-nums tracking-[0.04em] text-fg-faint">
                {solved}/{total} solved · ~{hours} h
              </p>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
