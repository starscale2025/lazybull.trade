"use client";

// /practice/contest — the weekly set. A countdown to the next Sunday edition
// (or to the close of the one in progress), the four problems, past editions
// and the board. Every row is an aggregation over real submissions
// (/api/practice/contest → lib/db/practice.ts contestBoard): whoever had an
// accepted submit on the set's problems inside the window, ranked on solves
// and then time — there is no P&L column because the row type has none
// (lib/practice/types.ts LeaderboardRow), and no prizes anywhere. An empty
// board is an empty board; it says so.
//
// The clock is touched only inside effects: the server and the first client
// render paint `--` in every tile and "№ —" in the title, then a one-second
// interval fills them from the client clock (lib/practice/contest.ts
// editionAt / nextStart are pure). Digits roll through
// components/pro/RollingNumber.tsx (reduced motion snaps). The interval is
// cleared on unmount.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Chip, PageHeader, Stats } from "@/components/calm/kit";
import { RollingNumber } from "@/components/pro/RollingNumber";
import { Panel } from "@/components/practice/Panel";
import { DifficultyPill, TrackChip } from "@/components/practice/Chips";
import { Empty, Td, Th, Tr } from "@/components/practice/Table";
import { fetchContest, type ContestResponse } from "@/lib/practice/client";
import { WEEKLY_SET, editionAt, formatCountdown, formatDuration, nextStart, type Edition } from "@/lib/practice/contest";
import { getMeta } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import type { ProblemMeta, ProgressState } from "@/lib/practice/types";

type Parts = ReturnType<typeof formatCountdown>;
const UNITS: { key: keyof Parts; label: string }[] = [
  { key: "d", label: "days" },
  { key: "h", label: "hours" },
  { key: "m", label: "minutes" },
  { key: "s", label: "seconds" },
];
const pad2 = (n: number) => String(Math.round(n)).padStart(2, "0");

/** How many of `problems` this solver's own ledger shows accepted inside
    [start, end) — the "you" column, from real rows, for the editions the
    solver took part in. */
function yourSolved(state: ProgressState, problems: string[], start: number, end: number): number {
  const set = new Set<string>();
  for (const slug of problems) {
    const first = state.solved[slug];
    if (first && first.at >= start && first.at < end) set.add(slug);
  }
  for (const s of state.submissions) {
    if (s.mode === "submit" && s.verdict === "accepted" && problems.includes(s.slug) && s.at >= start && s.at < end) set.add(s.slug);
  }
  return set.size;
}

export function ContestBoard() {
  const [data, setData] = useState<ContestResponse | "error" | null>(null);
  const [left, setLeft] = useState<Parts | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const { state, mounted } = usePracticeProgress();

  useEffect(() => {
    let alive = true;
    fetchContest().then((d) => {
      if (alive) setData(d ?? "error");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const e = editionAt(now);
      setEdition(e);
      setLeft(formatCountdown((e.open ? e.end : nextStart(now)) - now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const set = WEEKLY_SET.problems.map(getMeta).filter((p): p is ProblemMeta => p !== null);
  const board = data && data !== "error" ? data : null;
  const rows = board?.rows ?? [];
  const past = useMemo(() => {
    if (!board) return [];
    const len = board.set.durationMin * 60_000;
    return board.past.map((p) => {
      const start = Date.parse(p.startIso);
      return { ...p, start, you: mounted ? yourSolved(state, board.set.problems, start, start + len) : null };
    });
  }, [board, state, mounted]);

  return (
    <>
      <PageHeader
        eyebrow="Timed practice"
        title="Weekly set"
        accent={`№${edition ? edition.num : " —"}.`}
        lede="Four problems, ninety minutes, Sunday 20:00 IST. Ranked on solves and time — never on money. No sign-up: an accepted submit on any of the four inside the window puts you on the board."
      >
        {/* The countdown: the four figures of the kit's stat row. */}
        <div className="mt-10 t-label text-fg-faint">{edition?.open ? "Closes in" : "Next set in"}</div>
        <div
          role="timer"
          aria-live="off"
          aria-label={left ? `${edition?.open ? "closes" : "next set"} in ${left.d} days ${left.h} hours ${left.m} minutes` : "countdown loading"}
          className="mt-3"
        >
          <Stats
            className="max-sm:gap-x-6"
            items={UNITS.map((u) => ({
              label: u.label,
              value: left ? <RollingNumber value={Number(left[u.key])} format={pad2} /> : "--",
            }))}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-fg-faint">
          {edition?.open ? (
            <Chip tone="brand" dot>
              Open now — solve any of the four
            </Chip>
          ) : (
            <span>Problems stay solvable between editions; only the window counts</span>
          )}
          <span>Paper only · educational · not advice</span>
        </div>
      </PageHeader>

      <section className="shell pb-16">
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Panel
              calm
              title="The set"
              sub={`${set.length} problems · ${WEEKLY_SET.durationMin} minutes · Sunday 20:00 IST`}
              bodyClassName="px-3 pt-2"
              footer={<span className="t-label text-fg-faint">The same four every week for now — the set rotates once the board has a history</span>}
            >
              <ol>
                {set.map((p, i) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1.5rem_1fr] items-center gap-3 border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-2 py-3 last:border-b-0 sm:grid-cols-[1.5rem_1fr_auto]"
                  >
                    <span className="t-data text-[0.75rem] text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/practice/${p.id}`}
                        className="font-sans text-[0.9375rem] font-medium tracking-[-0.01em] text-fg hover:text-brand-ink"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-1">
                        <TrackChip track={p.track} />
                      </div>
                    </div>
                    <div className="col-start-2 flex items-center gap-2 sm:col-start-3">
                      <DifficultyPill difficulty={p.difficulty} />
                      <span className="whitespace-nowrap t-label text-fg-faint">{p.minutes} min</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel
              calm
              title="Past sets"
              right={board ? "From real submissions" : data === "error" ? "Unavailable" : "Loading"}
              bodyClassName="overflow-x-auto px-3 pb-2 pt-2"
            >
              {past.length === 0 ? (
                <Empty>{data === null ? "Loading…" : data === "error" ? "The board could not be reached" : "No past editions yet — this is the first"}</Empty>
              ) : (
                <table className="w-full t-data text-[0.6875rem]">
                  <thead>
                    <Tr head>
                      <Th left>№</Th>
                      <Th left>Date</Th>
                      <Th>Solvers</Th>
                      <Th>You</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {past.map((s) => (
                      <Tr key={s.num}>
                        <Td left strong>
                          №{s.num}
                        </Td>
                        <Td left>{mounted ? new Date(s.start).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</Td>
                        <Td>{s.solvers}</Td>
                        <Td>{s.you === null ? "—" : `${s.you}/${s.total}`}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel
            calm
            title="Board"
            sub="Ranked on solves, then time — never P&L"
            right={board ? (board.dbOk ? `№${board.set.num}` : "Unavailable") : data === "error" ? "Unavailable" : "Loading"}
            bodyClassName="overflow-x-auto px-3 pb-2 pt-2"
            footer={<span className="t-label text-fg-faint">No prizes, no cash, no returns — a practice set</span>}
          >
            {rows.length === 0 ? (
              <Empty>
                {data === null
                  ? "Loading…"
                  : data === "error" || !board?.dbOk
                    ? "The board could not be reached"
                    : board.set.upcoming
                      ? "The first edition has not started yet"
                      : "No accepted submits in this window yet"}
              </Empty>
            ) : (
              <table className="w-full t-data text-[0.6875rem]">
                <thead>
                  <Tr head>
                    <Th>#</Th>
                    <Th left>Solver</Th>
                    <Th>Solved</Th>
                    <Th>Time</Th>
                  </Tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.rank}>
                      <Td>
                        <span className={r.rank <= 3 ? "text-brand-ink" : "text-fg-faint"}>{r.rank}</span>
                      </Td>
                      <Td left strong>
                        {r.name}
                      </Td>
                      <Td>
                        {r.solved}
                        <span className="text-fg-faint">/{r.total}</span>
                      </Td>
                      <Td>{formatDuration(r.timeMs)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
