"use client";

// /practice/profile — the solver's practice ledger. Identity row, the solved
// ring, the year heatmap with streak stats, the badge case, recent
// submissions, per-track bars, the minted certificates and the certificate
// card. Every figure comes from the solver's own verdicts through
// lib/practice/progress.ts: this device's localStorage ledger, or the
// server's rows (/api/practice/me) once signed in — and the header says
// which one is on screen.
//
// The name comes from next-auth exactly as components/learn/Diploma.tsx:25
// does it — session name, else "Trader". Dates are only formatted once the
// progress hook reports `mounted`, so the server and the first client render
// both print "—" and nothing hydrates differently.

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { Panel } from "@/components/practice/Panel";
import { Eyebrow, TrackChip, VerdictPill } from "@/components/practice/Chips";
import { Empty, Stat, Td, Th, Tr } from "@/components/practice/Table";
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
    ? "this device's ledger · sign in to keep it across devices"
    : source === "server"
      ? "your ledger, from the server"
      : me && !me.anonymous && !me.dbOk
        ? "the server could not be reached — showing this device's ledger"
        : "reading this device's ledger while the server answers";

  return (
    <section className="shell section-y-sm">
      {/* header */}
      <Eyebrow>practice · profile</Eyebrow>
      <h1 className="mt-3 t-title">
        Your <span className="t-accent">practice</span> ledger.
      </h1>
      <div className="mt-3 t-chrome text-fg-faint">{sourceLine}</div>

      {/* identity */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span aria-hidden className="grid size-12 place-items-center border border-border bg-bg font-mono text-bull">
          {initialsFor(name)}
        </span>
        <div>
          <div className="font-display text-xl tracking-tightest text-fg">{name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 t-chrome text-fg-faint">
            <span>{signedIn ? "signed in" : "not signed in"}</span>
            <span aria-hidden>·</span>
            <span>{me ? `${me.plan} plan` : "free plan"}</span>
            <span aria-hidden>·</span>
            <span>paper only · educational · not advice</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <Panel title="Solved" bodyClassName="p-4">
            <SolvedRing solved={solved} total={total} size={160} caption="all tracks" />
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Panel title="Activity" sub="one cell per day · problems first solved that day" bodyClassName="p-4">
            <Heatmap activity={activity} endDay={today} weeks={52} showMonths />
            <div className="mt-4 grid grid-cols-3 gap-px border border-border bg-border">
              <Stat label="current streak" value={`${summary.streak.current}d`} />
              <Stat label="longest streak" value={`${summary.streak.longest}d`} />
              <Stat label="active days" value={summary.activeDays.length} />
            </div>
          </Panel>
        </div>

        <div className="col-span-12">
          <Panel title="Badges" sub="mastery and streaks only — never returns" bodyClassName="p-4">
            <BadgeGrid badges={badges} cols={6} className="max-md:grid-cols-3" />
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <Panel title="Recent submissions" right={source === "server" ? "server" : "this device"} bodyClassName="overflow-x-auto p-2">
            {recent.length === 0 ? (
              <Empty>no submissions yet — open a problem and press ▶ run</Empty>
            ) : (
              <table className="w-full t-data text-[0.6875rem]">
                <thead>
                  <Tr head>
                    <Th left>when</Th>
                    <Th left>problem</Th>
                    <Th left>mode</Th>
                    <Th left>lang</Th>
                    <Th left>verdict</Th>
                    <Th>runtime</Th>
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
                        <Link href={`/practice/${s.slug}`} className="text-fg hover:text-bull">
                          {titleFor(s.slug)}
                        </Link>
                      </Td>
                      <Td left>{s.mode}</Td>
                      <Td left>{LANG_META[s.lang].short}</Td>
                      <Td left>
                        <VerdictPill verdict={s.verdict} />
                      </Td>
                      <Td>{s.total > 0 ? `${s.runtimeMs} ms` : "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Panel title="Tracks" bodyClassName="p-3">
            <ul>
              {TRACK_ORDER.map((t) => {
                const row = summary.byTrack[t];
                return (
                  <li key={t} className="border-b border-border-soft py-2 last:border-b-0">
                    <Link href={`/practice/tracks/${t}`} className="flex items-center gap-3 hover:text-bull">
                      <TrackChip track={t} className="w-20 justify-center" />
                      <ProgressBar
                        value={row.total > 0 ? row.solved / row.total : 0}
                        color={TRACK_META[t].color}
                        className="flex-1"
                      />
                      <span className="w-10 text-right t-data text-[0.6875rem] text-fg-dim">
                        {row.solved}/{row.total}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {certificates.length > 0 && (
            <Panel title="Minted" sub="one per track, public by id" bodyClassName="p-3" className="mt-4">
              <ul>
                {certificates.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 border-b border-border-soft py-2 last:border-b-0">
                    <span className="flex items-center gap-2">
                      <TrackChip track={c.track} />
                      <span className="t-chrome text-fg-faint">{c.mintedAt.slice(0, 10)}</span>
                    </span>
                    <Link href={`/practice/certificate/${c.id}`} className="t-chrome text-fg-faint hover:text-bull">
                      verify →
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
  );
}
