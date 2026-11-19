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
// In the pitch deck's hand (2026-11-17): the /practice header, the countdown
// as four sunk wells with the deck's light-italic figures in them, flat panes
// ruled by hairlines and the tables set as slide 15 sets its own.
//
// The clock is touched only inside effects: the server and the first client
// render paint `--` in every tile and "№ —" in the title, then a one-second
// interval fills them from the client clock (lib/practice/contest.ts
// editionAt / nextStart are pure). Digits roll through
// components/pro/RollingNumber.tsx (reduced motion snaps). The interval is
// cleared on unmount.

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

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
      <header className="shell pb-10 pt-[clamp(3rem,7vw,5.5rem)]">
        <p className="deck-eyebrow deck-rise">Practice · Timed set</p>
        <h1 className="deck-h1 deck-rise mt-5 max-w-[20ch] text-fg" style={at(1)}>
          Weekly set <span className="deck-accent">№{edition ? edition.num : " —"}.</span>
        </h1>
        <p className="deck-lede deck-rise mt-6 max-w-[38rem]" style={at(2)}>
          Four problems, ninety minutes, Sunday 20:00 IST. Ranked on solves and time — never on money. No sign-up: an accepted
          submit on any of the four inside the window puts you on the board.
        </p>

        {/* The countdown: four sunk wells, the deck's figures in them. A dl,
            so each unit's name precedes its figure for a reader; the figure
            is drawn on top. */}
        <div className="deck-rise mt-10" style={at(3)}>
          <div className="deck-label">{edition?.open ? "Closes in" : "Next set in"}</div>
          <div
            role="timer"
            aria-live="off"
            aria-label={left ? `${edition?.open ? "closes" : "next set"} in ${left.d} days ${left.h} hours ${left.m} minutes` : "countdown loading"}
            className="mt-3"
          >
            <dl className="grid max-w-[42rem] grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {UNITS.map((u) => (
                <div
                  key={u.key}
                  className="flex flex-col-reverse gap-3 rounded-[12px] border border-border bg-[var(--deck-sunk)] px-4 pb-4 pt-5 sm:px-5"
                >
                  <dt className="deck-label">{u.label}</dt>
                  <dd className="deck-figure text-[clamp(2.5rem,5vw,3.5rem)] text-fg">
                    {left ? <RollingNumber value={Number(left[u.key])} format={pad2} /> : "--"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="deck-rise mt-6 flex flex-wrap items-center gap-x-5 gap-y-3" style={at(4)}>
          {edition?.open ? (
            <span className="deck-chip deck-chip-green">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
              Open now — solve any of the four
            </span>
          ) : (
            <span className="text-[0.875rem] text-fg-dim">Problems stay solvable between editions; only the window counts</span>
          )}
          <span className="font-mono text-[0.75rem] tracking-[0.04em] text-fg-faint">Paper only · educational · not advice</span>
        </div>
      </header>

      <section className="shell pb-[clamp(4rem,8vw,6rem)]">
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <div className="min-w-0 space-y-6">
            <Panel
              calm
              title="The set"
              sub={`${set.length} problems · ${WEEKLY_SET.durationMin} minutes · Sunday 20:00 IST`}
              bodyClassName="px-3 pt-2"
              footer={
                <span className="block border-t border-border pt-4 text-[0.8125rem] leading-snug text-fg-faint">
                  The same four every week for now — the set rotates once the board has a history
                </span>
              }
            >
              <ol>
                {set.map((p, i) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 border-b border-border px-2 py-4 last:border-b-0 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:gap-x-4"
                  >
                    <span className="t-data text-[0.75rem] text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/practice/${p.id}`}
                        className="font-sans text-[0.9375rem] font-medium tracking-[-0.005em] text-fg transition-colors hover:text-bull"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-2">
                        <TrackChip track={p.track} showGlyph />
                      </div>
                    </div>
                    <div className="col-start-2 flex items-center gap-3 sm:col-start-3">
                      <DifficultyPill difficulty={p.difficulty} />
                      <span className="whitespace-nowrap t-data text-[0.75rem] text-fg-faint">{p.minutes} min</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel
              calm
              title="Past sets"
              right={board ? "From real submissions" : data === "error" ? "Unavailable" : "Loading"}
              bodyClassName="overflow-x-auto px-3 pb-2 pt-3"
            >
              {past.length === 0 ? (
                <Empty>{data === null ? "Loading…" : data === "error" ? "The board could not be reached" : "No past editions yet — this is the first"}</Empty>
              ) : (
                <table className="deck-table w-full t-data text-[0.75rem]">
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
            bodyClassName="overflow-x-auto px-3 pb-2 pt-3"
            footer={
              <span className="block border-t border-border pt-4 text-[0.8125rem] leading-snug text-fg-faint">
                No prizes, no cash, no returns — a practice set
              </span>
            }
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
              <table className="deck-table w-full t-data text-[0.75rem]">
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
                        <span className={r.rank <= 3 ? "text-bull" : "text-fg-faint"}>{r.rank}</span>
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
