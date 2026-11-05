"use client";

// Practice progress in the browser — one ledger, two sources.
//
//   • localStorage under PROGRESS_KEY: every verdict this device has seen,
//     written the moment the judge returns one. For an anonymous solver this
//     IS the ledger — real, per device, and gone with the browser's storage.
//   • /api/practice/me once signed in: the server's rows (lib/db/practice.ts
//     progressFor), read by user id AND by this device's id, so the week
//     solved before signing in comes along. When the server answers it wins;
//     the local copy is what the page shows while the fetch is in flight and
//     when it fails.
//
// Modelled on lib/learn-progress.ts: raw localStorage behind try/catch
// (private mode just means nothing persists), a custom window event so every
// consumer — the list's ✓ column, the rail's ring, the profile's heatmap —
// re-reads the moment a verdict lands, plus `storage` for other tabs.
//
// The key is versioned. "lb-practice" (v1) was written by a judge that never
// executed anything; a ✓ it left behind is not a solve, so the first read
// under v2 deletes it rather than importing it.
//
// SSR-safe: the first render sees the empty state and FALLBACK_TODAY, so the
// server and the client agree; the effect then reads storage and the real
// calendar day. Date.now() never appears in a render path.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Lang, ProblemStatus, ProgressState, RunReport, Submission } from "./types";
import { fetchMe, type MeResponse } from "./client";
import { EMPTY_PROGRESS, dayKey, statusOf as pureStatusOf, summarizeProgress } from "./summary";

export const PROGRESS_KEY = "lb-practice-v2";
const LEGACY_KEY = "lb-practice";
export const PROGRESS_EVENT = "lb-practice-progress";
/** Any fixed day: what the server and the first client render draw against,
    until the effect reads the real calendar. */
export const FALLBACK_TODAY = "2026-09-07";
const MAX_SUBMISSIONS = 50;

function sanitise(raw: unknown): ProgressState {
  const o = (raw ?? {}) as Partial<ProgressState>;
  return {
    solved: o.solved && typeof o.solved === "object" ? o.solved : {},
    attempts: o.attempts && typeof o.attempts === "object" ? o.attempts : {},
    submissions: Array.isArray(o.submissions) ? o.submissions.filter((s) => s && typeof s === "object" && typeof s.slug === "string") : [],
  };
}

export function readProgress(): ProgressState {
  try {
    localStorage.removeItem(LEGACY_KEY);
    return sanitise(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"));
  } catch {
    return { solved: {}, attempts: {}, submissions: [] };
  }
}

export function writeProgress(state: ProgressState): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    /* private mode — nothing persists across reloads, the session still works */
  }
}

export function markAttempt(slug: string): void {
  const s = readProgress();
  s.attempts[slug] = (s.attempts[slug] ?? 0) + 1;
  writeProgress(s);
}

/** Books a verdict the judge returned. An accepted SUBMIT marks the problem
    solved. The attempt itself is counted by markAttempt when the run starts,
    so this does not touch `attempts`. Also drops the memoised server ledger:
    the row behind this verdict is already on the server, and the next read
    should see it. */
export function recordVerdict(slug: string, lang: Lang, report: RunReport): Submission {
  const s = readProgress();
  const now = Date.now();
  const sub: Submission = {
    id: `local-${now.toString(36)}`,
    slug,
    lang,
    mode: report.mode,
    verdict: report.verdict,
    passed: report.passed,
    total: report.total,
    runtimeMs: report.runtimeMs,
    at: now,
  };
  s.submissions = [sub, ...s.submissions].slice(0, MAX_SUBMISSIONS);
  if (report.mode === "submit" && report.verdict === "accepted" && !s.solved[slug]) {
    s.solved[slug] = { at: now, lang, runtimeMs: report.runtimeMs };
  }
  invalidateMe();
  writeProgress(s);
  return sub;
}

/** Wipes this device's ledger. The server's rows are untouched — a signed-in
    solver's history comes straight back from /api/practice/me. */
export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LEGACY_KEY);
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    /* private mode */
  }
}

/* ── the server ledger ───────────────────────────────────────────────────── */

const ME_TTL_MS = 30_000;
let meCache: { at: number; me: MeResponse } | null = null;
let meInflight: Promise<MeResponse> | null = null;

export function invalidateMe(): void {
  meCache = null;
}

function loadMe(): Promise<MeResponse> {
  if (meCache && Date.now() - meCache.at < ME_TTL_MS) return Promise.resolve(meCache.me);
  if (meInflight) return meInflight;
  meInflight = fetchMe()
    .then((me) => {
      meCache = { at: Date.now(), me };
      return me;
    })
    .finally(() => {
      meInflight = null;
    });
  return meInflight;
}

export type ProgressSource = "device" | "server";

export function usePracticeProgress() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [local, setLocal] = useState<ProgressState>(EMPTY_PROGRESS);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [today, setToday] = useState(FALLBACK_TODAY);
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const read = () => {
      setLocal(readProgress());
      setToday(dayKey(Date.now()));
      setTick((t) => t + 1);
    };
    read();
    setMounted(true);
    window.addEventListener(PROGRESS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  // The server ledger, re-read after every local write (tick) and on sign-in.
  useEffect(() => {
    if (!signedIn) {
      setMe(null);
      return;
    }
    let alive = true;
    loadMe().then(
      (m) => {
        if (alive) setMe(m);
      },
      () => {
        /* unreachable — keep reading this device's ledger */
      }
    );
    return () => {
      alive = false;
    };
  }, [signedIn, tick]);

  const serverState = me && !me.anonymous && me.progress ? me.progress : null;
  const state = serverState ?? local;
  const source: ProgressSource = serverState ? "server" : "device";
  const summary = useMemo(() => summarizeProgress(state, today), [state, today]);
  const statusOf = useMemo(() => (slug: string): ProblemStatus => pureStatusOf(state, slug), [state]);
  const refresh = useCallback(() => {
    invalidateMe();
    setTick((t) => t + 1);
  }, []);

  return { state, summary, today, statusOf, mounted, signedIn, source, me, refresh };
}
