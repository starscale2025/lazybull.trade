"use client";

// The five track cards on /practice, on the calm kit (S1, 2026-11-09): soft
// panels that brighten under the pointer, the glyph on a round tile, the hint
// in sentence case and the reading colour. They were a hairline grid with each
// hint in its track's colour and mono caps, ML's in loss red. A client
// component because every card reads solved/total from the progress hook —
// its first render is the empty ledger, identical on the server and the
// client, so nothing hydrates differently.

import Link from "next/link";
import { TrackGlyph } from "@/components/practice/Chips";
import { ProgressBar } from "@/components/practice/ProgressBar";
import { usePracticeProgress } from "@/lib/practice/progress";
import { trackStats } from "@/lib/practice/problems";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

export function TrackCards() {
  const { summary } = usePracticeProgress();

  return (
    <nav id="tracks" aria-label="Tracks" className="grid scroll-mt-24 grid-cols-2 gap-3 md:grid-cols-5">
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
            className="calm-panel calm-card group relative p-5 last:col-span-2 md:last:col-span-1"
          >
            <i aria-hidden className="lit-aura" />
            <TrackGlyph track={t} size="sm" />
            <div className="mt-4 text-[1rem] font-semibold tracking-[-0.01em] text-fg">{meta.label}</div>
            <div className="mt-0.5 text-[0.8125rem] leading-snug text-fg-dim">
              {meta.hint.charAt(0).toUpperCase() + meta.hint.slice(1)}
            </div>
            <ProgressBar value={total > 0 ? solved / total : 0} color={meta.color} className="mt-4" />
            <div className="mt-2 text-[0.75rem] tabular-nums text-fg-faint">
              {solved} of {total} · about {hours} h
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
