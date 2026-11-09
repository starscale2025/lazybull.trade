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
import { CalmLink, PageHeader, Stats } from "@/components/calm/kit";
import { Panel } from "@/components/practice/Panel";
import { TrackChip } from "@/components/practice/Chips";
import { Empty, Td, Th, Tr } from "@/components/practice/Table";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { Heatmap } from "@/components/practice/Heatmap";
import { BadgeGrid, VerdictChip } from "@/components/practice/Badges";
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
    ? "This device’s ledger · sign in to keep it across devices"
    : source === "server"
      ? "Your ledger, from the server"
      : me && !me.anonymous && !me.dbOk
        ? "The server could not be reached — showing this device’s ledger"
        : "Reading this device’s ledger while the server answers";

  return (
    <>
      <PageHeader
        eyebrow="Practice profile"
        title={
          <>
            Your <span className="t-accent">practice</span> ledger.
          </>
        }
        lede={sourceLine}
      >
        {/* identity */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-brand-ink/14 font-display text-[1.0625rem] text-brand-ink">
            {initialsFor(name)}
          </span>
          <div>
            <div className="font-display text-xl tracking-tightest text-fg">{name}</div>
            <div className="mt-0.5 t-label text-fg-faint">
              {signedIn ? "Signed in" : "Not signed in"} · {me ? `${me.plan} plan` : "free plan"}
            </div>
          </div>
        </div>
        {/* The compliance line: one per page, visible without scrolling. */}
        <p className="mt-6 text-[0.8125rem] text-fg-faint">Paper only · educational · not advice</p>
      </PageHeader>

      <section className="shell pb-16">
        <div className="mt-8 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4">
            <Panel calm title="Solved" bodyClassName="px-5 pb-5 pt-4">
              <SolvedRing solved={solved} total={total} size={160} caption="all tracks" />
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <Panel calm title="Activity" sub="One cell per day · problems first solved that day" bodyClassName="px-5 pb-5 pt-4">
              <Heatmap activity={activity} endDay={today} weeks={52} showMonths />
              <Stats
                className="mt-5"
                items={[
                  { value: `${summary.streak.current} d`, label: "current streak" },
                  { value: `${summary.streak.longest} d`, label: "longest streak" },
                  { value: summary.activeDays.length, label: "active days" },
                ]}
              />
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel calm title="Badges" sub="Mastery and streaks only — never returns" bodyClassName="px-5 pb-5 pt-4">
              <BadgeGrid badges={badges} cols={6} className="max-md:grid-cols-3" />
            </Panel>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <Panel calm title="Recent submissions" right={source === "server" ? "Server" : "This device"} bodyClassName="overflow-x-auto px-3 pb-2 pt-2">
              {recent.length === 0 ? (
                <Empty>No submissions yet — open a problem and press ▶ Run</Empty>
              ) : (
                <table className="w-full t-data text-[0.6875rem]">
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
                          <Link href={`/practice/${s.slug}`} className="text-fg hover:text-brand-ink">
                            {titleFor(s.slug)}
                          </Link>
                        </Td>
                        <Td left>{s.mode}</Td>
                        <Td left>{LANG_META[s.lang].short}</Td>
                        <Td left>
                          <VerdictChip verdict={s.verdict} />
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
          <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
            <Panel calm title="Tracks" bodyClassName="px-5 pb-4 pt-3">
              <ul>
                {TRACK_ORDER.map((t) => {
                  const row = summary.byTrack[t];
                  return (
                    <li key={t} className="border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)] py-2 last:border-b-0">
                      <Link href={`/practice/tracks/${t}`} className="flex items-center gap-3 hover:text-brand-ink">
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
              <Panel calm title="Minted" sub="One per track, public by id" bodyClassName="px-5 pb-4 pt-3">
                <ul>
                  {certificates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)] py-2 last:border-b-0">
                      <span className="flex items-center gap-2">
                        <TrackChip track={c.track} />
                        <span className="t-label text-fg-faint">{c.mintedAt.slice(0, 10)}</span>
                      </span>
                      <CalmLink href={`/practice/certificate/${c.id}`}>Verify</CalmLink>
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
