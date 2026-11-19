"use client";

// The problem set on /practice — 48 rows, filterable by text, track, level
// and status, each row's ● / ◐ / ○ read live from the progress hook so an
// accepted submit ticks the list the moment you come back. Set the deck's way
// (slide 15's table): mono capitals over a strong rule, a title with a grey
// second line, hairlines between rows. On a phone the row folds to the title,
// its meta line and the status circle.
//
// The acceptance column is accepted ÷ submitted over real submissions
// (/api/practice/stats via lib/practice/client.ts useAcceptance) and reads
// "—" until a problem has enough of them — the footer says how many.
//
// The board also registers the page's ⌘K commands (lib/command-deck.ts) and
// unregisters on unmount. No Date.now(), no Math.random() in render: the
// random pick happens inside a command's `run`, which only fires from a key.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
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
  { id: "todo", label: "to do" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One filter: the kit's TogglePill, re-skinned by .deck. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <TogglePill on={on} onClick={onClick}>
      {cap(children)}
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
      <span aria-hidden className="deck-label mr-1.5 w-full sm:w-auto">
        {label}
      </span>
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

  const filtered = q !== "" || track !== "all" || difficulty !== "all" || status !== "all";
  const clearFilters = () => {
    setQ("");
    setTrack("all");
    setDifficulty("all");
    setStatus("all");
  };

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
    <div className="deck-pane flex flex-col">
      {/* search + filters */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search problems</span>
            <Search aria-hidden size={15} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search problems, tags, numbers"
              aria-label="search problems"
              className="calm-input w-full !pl-9"
            />
          </label>
          <span aria-live="polite" className="deck-label ml-auto whitespace-nowrap">
            {visible.length} of {PROBLEMS.length}
          </span>
          {filtered && (
            <button type="button" onClick={clearFilters} className="deck-btn deck-btn-sm">
              <X aria-hidden size={12} strokeWidth={2} />
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-6">
          <ChipGroup label="Track">
            <Chip on={track === "all"} onClick={() => setTrack("all")}>
              all
            </Chip>
            {TRACK_ORDER.map((t) => (
              <Chip key={t} on={track === t} onClick={() => setTrack(t)}>
                {TRACK_META[t].label}
              </Chip>
            ))}
          </ChipGroup>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <ChipGroup label="Level">
              {DIFFICULTIES.map((d) => (
                <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(difficulty === d ? "all" : d)}>
                  {DIFFICULTY_META[d].label}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup label="Status">
              {STATUSES.map((s) => (
                <Chip key={s.id} on={status === s.id} onClick={() => setStatus(status === s.id ? "all" : s.id)}>
                  {s.label}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        </div>
      </div>

      {/* the table */}
      <div className="overflow-x-auto px-2 pt-3 sm:px-3">
        <table className="deck-table w-full t-data text-[0.75rem]">
          <thead>
            <Tr head>
              <Th left className="w-7 pl-3">
                <span className="sr-only">Status</span>
              </Th>
              <Th left className="hidden w-10 sm:table-cell">
                №
              </Th>
              <Th left>Problem</Th>
              <Th left className="hidden md:table-cell">
                Track
              </Th>
              <Th left className="hidden sm:table-cell">
                Level
              </Th>
              <Th className="hidden xl:table-cell">Acceptance</Th>
              <Th className="hidden md:table-cell">Time</Th>
              <Th className="w-10 pr-3">
                <span className="sr-only">Open</span>
              </Th>
            </Tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <Tr key={p.id}>
                <Td left className="pl-3 align-top sm:align-middle">
                  <span className="inline-flex pt-0.5 sm:pt-0">
                    <StatusGlyph status={statusOf(p.id)} />
                  </span>
                </Td>
                <Td left className="hidden text-fg-faint sm:table-cell">
                  {String(p.num).padStart(2, "0")}
                </Td>
                <Td left strong className="min-w-[11rem] py-3.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/practice/${p.id}`}
                      className="font-sans text-[0.9375rem] font-medium tracking-[-0.005em] text-fg transition-colors hover:text-bull"
                    >
                      {p.title}
                    </Link>
                    {p.lock && <LockPill lock={p.lock} />}
                    {p.featured && (
                      <span role="img" aria-label="featured" title="Featured: full editorial" className="text-[0.75rem] text-amber">
                        ★
                      </span>
                    )}
                  </span>
                  {/* w-0 + min-w-full: the blurb truncates to the width the title
                      gives the column instead of widening the column to fit
                      itself (an auto-layout table sizes to min-content). */}
                  <span className="mt-1 hidden w-0 min-w-full truncate font-sans text-[0.8125rem] text-fg-faint md:block">
                    {p.blurb}
                  </span>
                  <span className="mt-1 block font-sans text-[0.75rem] text-fg-faint md:hidden">
                    {TRACK_META[p.track].label}
                    <span className="sm:hidden"> · {cap(DIFFICULTY_META[p.difficulty].label)}</span> · {p.minutes} min
                  </span>
                </Td>
                <Td left className="hidden md:table-cell">
                  <TrackChip track={p.track} />
                </Td>
                <Td left className="hidden sm:table-cell">
                  <DifficultyPill difficulty={p.difficulty} />
                </Td>
                <Td className="hidden xl:table-cell">
                  <Acceptance rate={rateFor(p.id)} count={countFor(p.id)} loaded={loaded} min={minSubmissions} />
                </Td>
                <Td className="hidden whitespace-nowrap md:table-cell">{p.minutes} min</Td>
                <Td className="pr-3">
                  <Link
                    href={`/practice/${p.id}`}
                    aria-label={`Solve ${p.title}`}
                    className="inline-grid size-8 place-items-center rounded-full font-sans text-[0.9375rem] text-fg-faint transition-colors hover:bg-[var(--deck-raised)] hover:text-bull"
                  >
                    <span aria-hidden className="deck-arrow">
                      →
                    </span>
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <Empty>
            No problems match.{" "}
            <button type="button" onClick={clearFilters} className="deck-link text-[0.875rem]">
              Clear the filters
            </button>
          </Empty>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border px-4 py-3.5 text-[0.75rem] text-fg-faint sm:px-5">
        <span>Acceptance is accepted ÷ submitted, from real submissions; “—” until a problem has {minSubmissions}.</span>
        <span>Paper only · educational · not advice</span>
      </div>
    </div>
  );
}
