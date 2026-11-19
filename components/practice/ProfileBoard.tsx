"use client";

// /practice/profile — the solver's practice ledger. Identity row, the solved
// ring, the year heatmap with streak stats, the badge case, recent
// submissions, per-track bars, the minted certificates and the certificate
// card. Every figure comes from the solver's own verdicts through
// lib/practice/progress.ts: this device's localStorage ledger, or the
// server's rows (/api/practice/me) once signed in — and the header says
// which one is on screen.
//
// In the pitch deck's hand (2026-11-17): the /practice header with the
// identity beside it, flat panes ruled by hairlines, the streak figures in the
// deck's light-italic serif, the submissions set as slide 15 sets its table,
// and the certificate on the deck's paper (components/practice/Certificate.tsx).
//
// The name comes from next-auth exactly as components/learn/Diploma.tsx:25
// does it — session name, else "Trader". Dates are only formatted once the
// progress hook reports `mounted`, so the server and the first client render
// both print "—" and nothing hydrates differently.

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { Panel } from "@/components/practice/Panel";
import { TrackChip, VerdictPill } from "@/components/practice/Chips";
import { Empty, Td, Th, Tr } from "@/components/practice/Table";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { Heatmap } from "@/components/practice/Heatmap";
import { BadgeGrid } from "@/components/practice/Badges";
import { ProgressBar } from "@/components/practice/ProgressBar";
import { Certificate } from "@/components/practice/Certificate";
import { titleFor } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import { activityFor, computeBadges } from "@/lib/practice/summary";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";
import { LANG_META } from "@/lib/practice/types";

const RECENT_ROWS = 12;
const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "T";
}

export function ProfileBoard() {
  const { data: session } = useSession();
  const { state, summary, today, mounted, signedIn, source, me, refresh } = usePracticeProgress();
  const name = session?.user?.name || "Trader";

  const activity = useMemo(() => activityFor(state), [state]);
  const badges = useMemo(() => computeBadges(summary), [summary]);
  const recent = useMemo(() => [...state.submissions].sort((a, b) => b.at - a.at).slice(0, RECENT_ROWS), [state.submissions]);
  const certificates = me && !me.anonymous ? me.certificates : [];

  const solved = {
    easy: summary.byDifficulty.easy.solved,
    medium: summary.byDifficulty.medium.solved,
    hard: summary.byDifficulty.hard.solved,
  };
  const total = {
    easy: summary.byDifficulty.easy.total,
    medium: summary.byDifficulty.medium.total,
    hard: summary.byDifficulty.hard.total,
  };

  const sourceLine = !signedIn
    ? "This device’s ledger · sign in to keep it across devices"
    : source === "server"
      ? "Your ledger, from the server"
      : me && !me.anonymous && !me.dbOk
        ? "The server could not be reached — showing this device’s ledger"
        : "Reading this device’s ledger while the server answers";

  const streakFigures: { label: string; value: number; unit?: string }[] = [
    { label: "Current streak", value: summary.streak.current, unit: "d" },
    { label: "Longest streak", value: summary.streak.longest, unit: "d" },
    { label: "Active days", value: summary.activeDays.length },
  ];

  return (
    <>
      <header className="shell pb-10 pt-[clamp(3rem,7vw,5.5rem)]">
        <div className="grid items-end gap-x-16 gap-y-9 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="deck-eyebrow deck-rise">Practice · Profile</p>
            <h1 className="deck-h1 deck-rise mt-5 max-w-[20ch] text-fg" style={at(1)}>
              Your <span className="deck-accent">practice</span> ledger.
            </h1>
            <p className="deck-lede deck-rise mt-6 max-w-[38rem]" style={at(2)}>
              {sourceLine}
            </p>
          </div>

          {/* identity — the mockup's avatar: initials on a raised disc */}
          <div className="deck-rise flex min-w-0 items-center gap-4 lg:max-w-[22rem] lg:pb-1.5" style={at(3)}>
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--deck-raised)] font-sans text-[0.9375rem] font-semibold tracking-[0.02em] text-fg shadow-[inset_0_0_0_1px_var(--deck-rule)]"
            >
              {initialsFor(name)}
            </span>
            <div className="min-w-0">
              <div className="deck-display break-words text-[1.375rem] leading-tight tracking-[-0.02em] text-fg">{name}</div>
              <div className="deck-label mt-1.5">
                {signedIn ? "Signed in" : "Not signed in"} · {me ? `${me.plan} plan` : "free plan"}
              </div>
            </div>
          </div>
        </div>
        {/* The compliance line: one per page, visible without scrolling. */}
        <p
          className="deck-rise mt-9 border-t border-[var(--deck-rule)] pt-4 font-mono text-[0.75rem] tracking-[0.04em] text-fg-faint"
          style={at(4)}
        >
          Paper only · educational · not advice
        </p>
      </header>

      <section className="shell pb-[clamp(4rem,8vw,6rem)]">
        <div className="mt-2 grid grid-cols-12 gap-4 lg:gap-5">
          <div className="col-span-12 lg:col-span-4">
            <Panel calm title="Solved" bodyClassName="px-5 pb-6 pt-6">
              <SolvedRing solved={solved} total={total} size={160} caption="all tracks" />
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <Panel calm title="Activity" sub="One cell per day · problems first solved that day" bodyClassName="px-5 pb-5 pt-5">
              {/* A year keeps a legible cell on a phone by scrolling inside its
                  own frame. The frame runs right-to-left so it opens on the
                  latest weeks; the grid inside reads left-to-right. */}
              <div className="overflow-x-auto pb-1 [direction:rtl]">
                <Heatmap activity={activity} endDay={today} weeks={52} showMonths className="min-w-[34rem] [direction:ltr]" />
              </div>
              <dl className="mt-5 grid grid-cols-3 border-t border-border">
                {streakFigures.map((f, i) => (
                  <div
                    key={f.label}
                    className={`flex flex-col gap-2 pt-4 ${i < streakFigures.length - 1 ? "pr-3" : ""} ${i > 0 ? "border-l border-border pl-4 sm:pl-6" : ""}`}
                  >
                    <dt className="deck-label">{f.label}</dt>
                    <dd className="deck-figure text-[clamp(2rem,3.6vw,2.75rem)] text-fg">
                      {f.value}
                      {f.unit && <span className="ml-1 font-sans text-[0.875rem] not-italic text-fg-faint">{f.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel calm title="Badges" sub="Mastery and streaks only — never returns" bodyClassName="px-5 pb-6 pt-5">
              <BadgeGrid badges={badges} cols={6} className="max-md:grid-cols-3" />
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <Panel calm title="Recent submissions" right={source === "server" ? "Server" : "This device"} bodyClassName="overflow-x-auto px-3 pb-2 pt-3">
              {recent.length === 0 ? (
                <Empty>No submissions yet — open a problem and press ▶ Run</Empty>
              ) : (
                <table className="deck-table w-full t-data text-[0.75rem]">
                  <thead>
                    <Tr head>
                      <Th left>When</Th>
                      <Th left>Problem</Th>
                      <Th left>Mode</Th>
                      <Th left>Lang</Th>
                      <Th left>Verdict</Th>
                      <Th>Runtime</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {recent.map((s) => (
                      <Tr key={`${s.id}-${s.at}`}>
                        <Td left>
                          <span className="whitespace-nowrap">
                            {mounted ? new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                          </span>
                        </Td>
                        <Td left strong>
                          <Link href={`/practice/${s.slug}`} className="font-sans text-[0.875rem] font-medium text-fg transition-colors hover:text-bull">
                            {titleFor(s.slug)}
                          </Link>
                        </Td>
                        <Td left>{s.mode}</Td>
                        <Td left>{LANG_META[s.lang].short}</Td>
                        <Td left>
                          <VerdictPill verdict={s.verdict} className="whitespace-nowrap" />
                        </Td>
                        <Td>{s.total > 0 ? `${s.runtimeMs} ms` : "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          {/* A flex column, so the two h-full panels share the cell instead of
              the second one spilling out of it. */}
          <div className="col-span-12 flex flex-col gap-4 lg:col-span-5 lg:gap-5">
            <Panel calm title="Tracks" bodyClassName="px-5 pb-3 pt-2">
              <ul>
                {TRACK_ORDER.map((t) => {
                  const row = summary.byTrack[t];
                  return (
                    <li key={t} className="border-b border-border last:border-b-0">
                      <Link href={`/practice/tracks/${t}`} className="group flex items-center gap-3 py-3">
                        <TrackChip track={t} showGlyph className="w-[6.5rem] shrink-0" />
                        <ProgressBar
                          value={row.total > 0 ? row.solved / row.total : 0}
                          color={TRACK_META[t].color}
                          className="min-w-0 flex-1"
                        />
                        <span className="w-11 text-right t-data text-[0.75rem] text-fg-dim">
                          {row.solved}/{row.total}
                        </span>
                        <span aria-hidden className="deck-arrow text-fg-faint transition-colors group-hover:text-bull">
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            {certificates.length > 0 && (
              <Panel calm title="Minted" sub="One per track, public by id" bodyClassName="px-5 pb-3 pt-2">
                <ul>
                  {certificates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <TrackChip track={c.track} showGlyph />
                        <span className="t-data text-[0.75rem] text-fg-faint">{c.mintedAt.slice(0, 10)}</span>
                      </span>
                      <Link href={`/practice/certificate/${c.id}`} className="deck-link text-[0.875rem]">
                        Verify
                        <span aria-hidden className="deck-arrow">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="col-span-12">
            <Certificate name={name} summary={summary} signedIn={signedIn} certificates={certificates} onMinted={() => refresh()} />
          </div>
        </div>
      </section>
    </>
  );
}
