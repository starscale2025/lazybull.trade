"use client";

// The problems table on /practice — 48 rows, filterable by text, track,
// difficulty and status, each row's ✓ / ◐ / ○ read live from the progress
// hook so an accepted submit ticks the list the moment you come back.
//
// The search input and the filter chips are copied from the bot library in
// components/quant/BotLibrary.tsx (lines 57-90); the table is the Tr/Th/Td set
// in ./Table.tsx; the frame is ./Panel.tsx. The board also registers the
// page's ⌘K commands (lib/command-deck.ts) and unregisters on unmount.
//
// The acceptance column is accepted ÷ submitted over real submissions
// (/api/practice/stats via lib/practice/client.ts useAcceptance) and reads
// "—" until a problem has enough of them — the footer says how many.
//
// No Date.now(), no Math.random() in render: the random pick happens inside a
// command's `run`, which only ever fires from a keypress.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Panel } from "@/components/practice/Panel";
import { TogglePill } from "@/components/calm/kit";
import { DifficultyPill, LockPill, StatusGlyph, TrackChip } from "@/components/practice/Chips";
import { Empty, Td, Th, Tr } from "@/components/practice/Table";
import { registerCommands } from "@/lib/command-deck";
import { DIFFICULTY_META, type Difficulty, type ProblemStatus, type TrackId } from "@/lib/practice/types";
import { useAcceptance } from "@/lib/practice/client";
import { DAILY_SLUG, PROBLEMS } from "@/lib/practice/problems";
import { clearProgress, usePracticeProgress } from "@/lib/practice/progress";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

type TrackFilter = TrackId | "all";
type DifficultyFilter = Difficulty | "all";
type StatusFilter = ProblemStatus | "all";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const STATUSES: { id: ProblemStatus; label: string }[] = [
  { id: "solved", label: "solved" },
  { id: "attempted", label: "attempted" },
  { id: "todo", label: "todo" },
];

/** One filter: the kit's TogglePill (calm, S1), labelled in sentence case. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <TogglePill on={on} onClick={onClick}>
      {children.charAt(0).toUpperCase() + children.slice(1)}
    </TogglePill>
  );
}

/** The rate, or "—" with the reason in the title. */
function Acceptance({ rate, count, loaded, min }: { rate: number | null; count: number; loaded: boolean; min: number }) {
  if (rate !== null) return <span title={`${count} submitted`}>{(rate * 100).toFixed(1)}%</span>;
  return (
    <span className="text-fg-faint" title={loaded ? `${count} submitted · shown after ${min}` : "loading"}>
      —
    </span>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {children}
    </div>
  );
}

export function ProblemBoard() {
  const router = useRouter();
  const { statusOf } = usePracticeProgress();
  const { rateFor, countFor, loaded, minSubmissions } = useAcceptance();
  const [q, setQ] = useState("");
  const [track, setTrack] = useState<TrackFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (track !== "all" && p.track !== track) return false;
      if (difficulty !== "all" && p.difficulty !== difficulty) return false;
      if (status !== "all" && statusOf(p.id) !== status) return false;
      if (!needle) return true;
      const hay = `${p.title} ${p.blurb} ${p.id} ${p.tags.join(" ")} ${p.num}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q, track, difficulty, status, statusOf]);

  // ⌘K. Re-registered when the solved set changes so "random unsolved" never
  // hands out a problem that was just accepted.
  useEffect(() => {
    return registerCommands("practice", [
      {
        id: "practice-daily",
        label: "Open the daily problem",
        group: "practice",
        run: () => router.push(`/practice/${DAILY_SLUG}`),
      },
      {
        id: "practice-random",
        label: "Open a random unsolved problem",
        group: "practice",
        run: () => {
          const pool = PROBLEMS.filter((p) => statusOf(p.id) !== "solved" && !p.lock);
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) router.push(`/practice/${pick.id}`);
        },
      },
      {
        id: "practice-clear",
        label: "Clear this device's practice progress",
        group: "practice",
        run: () => clearProgress(),
      },
      {
        id: "practice-clear-filters",
        label: "Clear practice filters",
        group: "practice",
        run: () => {
          setQ("");
          setTrack("all");
          setDifficulty("all");
          setStatus("all");
        },
      },
    ]);
  }, [router, statusOf]);

  return (
    <Panel
      calm
      title="Problems"
      right={`${visible.length} of ${PROBLEMS.length}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.75rem] text-fg-faint">
          <span>
            Acceptance is accepted ÷ submitted, from real submissions; “—” until a problem has {minSubmissions}.
          </span>
          <span>Paper only · educational · not advice</span>
        </div>
      }
    >
      {/* filter strip */}
      <div className="flex flex-wrap items-center gap-2.5 px-5 pb-2 pt-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems"
          aria-label="search problems"
          className="calm-input w-full max-w-xs"
        />
        <ChipGroup label="track">
          <Chip on={track === "all"} onClick={() => setTrack("all")}>
            all
          </Chip>
          {TRACK_ORDER.map((t) => (
            <Chip key={t} on={track === t} onClick={() => setTrack(t)}>
              {TRACK_META[t].label}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="difficulty">
          {DIFFICULTIES.map((d) => (
            <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(difficulty === d ? "all" : d)}>
              {DIFFICULTY_META[d].label}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="status">
          {STATUSES.map((s) => (
            <Chip key={s.id} on={status === s.id} onClick={() => setStatus(status === s.id ? "all" : s.id)}>
              {s.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      {/* the table */}
      <div className="overflow-x-auto px-3 pb-2 pt-2">
        <table className="w-full t-data text-[0.6875rem]">
          <thead>
            <Tr head>
              <Th left className="w-6">
                <span className="sr-only">status</span>
              </Th>
              <Th>#</Th>
              <Th left className="min-w-[14rem]">
                Title
              </Th>
              <Th left>Track</Th>
              <Th left>Difficulty</Th>
              <Th>Acceptance</Th>
              <Th>Time</Th>
              <Th>
                <span className="sr-only">open</span>
              </Th>
            </Tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <Tr key={p.id}>
                <Td left>
                  <StatusGlyph status={statusOf(p.id)} />
                </Td>
                <Td>
                  <span className="text-fg-faint">{String(p.num).padStart(2, "0")}</span>
                </Td>
                <Td left strong>
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/practice/${p.id}`} className="font-sans text-[0.875rem] text-fg hover:text-brand-ink">
                      {p.title}
                    </Link>
                    {p.lock && <LockPill lock={p.lock} />}
                    {p.featured && (
                      <span role="img" aria-label="featured" title="featured" className="text-amber">
                        ★
                      </span>
                    )}
                  </span>
                </Td>
                <Td left>
                  <TrackChip track={p.track} />
                </Td>
                <Td left>
                  <DifficultyPill difficulty={p.difficulty} />
                </Td>
                <Td>
                  <Acceptance rate={rateFor(p.id)} count={countFor(p.id)} loaded={loaded} min={minSubmissions} />
                </Td>
                <Td>{p.minutes} min</Td>
                <Td>
                  <Link href={`/practice/${p.id}`} className="font-sans text-[0.8125rem] text-fg-faint hover:text-brand-ink">
                    Solve ›
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <Empty>no problems match</Empty>}
      </div>
    </Panel>
  );
}
