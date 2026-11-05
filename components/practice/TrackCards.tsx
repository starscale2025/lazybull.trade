"use client";

// The five track cards on /practice. The hairline `gap-px bg-border` grid and
// the bull underline that sweeps in from the left on hover are copied from the
// site index in components/GetStarted.tsx (lines 425-470); the glyph tile is
// TrackGlyph. A client component because every card reads solved/total from
// the progress hook — its first render is the empty ledger, identical on the
// server and the client, so nothing hydrates differently.

import Link from "next/link";
import { TrackGlyph } from "@/components/practice/Chips";
import { ProgressBar } from "@/components/practice/ProgressBar";
import { usePracticeProgress } from "@/lib/practice/progress";
import { trackStats } from "@/lib/practice/problems";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

export function TrackCards() {
  const { summary } = usePracticeProgress();

  return (
    <nav aria-label="Tracks" className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5">
      {TRACK_ORDER.map((t) => {
        const meta = TRACK_META[t];
        const { solved, total } = summary.byTrack[t];
        const { hours } = trackStats(t);
        return (
          // Five cells in two columns leave a lone fifth cell at the bottom;
          // it spans the row below md so the instrument face stays whole
          // (the same orphan rule GetStarted.tsx applies to its 3×3).
          <Link
            key={t}
            href={`/practice/tracks/${t}`}
            className="group relative bg-bg p-4 hover:bg-surface-2 last:col-span-2 md:last:col-span-1"
          >
            <TrackGlyph track={t} size="sm" />
            <div className="mt-3 font-display text-[0.9375rem] tracking-tightest text-fg group-hover:text-bull">
              {meta.label}
            </div>
            <div className="mt-0.5 t-chrome" style={{ color: meta.color }}>
              {meta.hint}
            </div>
            <ProgressBar value={total > 0 ? solved / total : 0} color={meta.color} className="mt-3" />
            <div className="mt-1.5 t-data t-chrome text-fg-faint">
              {solved}/{total} · ~{hours}h
            </div>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-bull transition-transform duration-300 group-hover:scale-x-100"
            />
          </Link>
        );
      })}
    </nav>
  );
}
