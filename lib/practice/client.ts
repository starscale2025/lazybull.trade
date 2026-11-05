"use client";

// The browser's door to /api/practice/* — every fetch the workspace, the
// boards and the profile make, in one place, so the device header, the JSON
// bodies and the 402 "locked" shape are handled once. Plain fetch wrappers
// plus one small hook; no component calls fetch() itself.
//
// Identity: the anonymous device id is the localStorage uuid lib/track.ts
// writes under "lb-device" — read here with the same fallback, never minted
// differently — and travels as the DEVICE_HEADER on every call and inside the
// submit body, so a solver's rows link up when they sign in later
// (lib/db/practice.ts reads by user id AND device).
//
// Nothing here throws on a bad status: every wrapper returns a discriminated
// result the caller renders. A network failure is the one thrown error, and
// only fetchMe lets it through — the progress hook treats it as "keep reading
// this device's ledger".

import { useEffect, useState } from "react";
import type { Plan, PlanLimits } from "@/lib/billing/types";
import type { CaseOutput, CaseResult, CertificateRecord, LeaderboardRow, PastSet, ProgressState, RunMode, SlugStats, TrackId, Verdict } from "./types";
import { DEVICE_HEADER } from "./types";

/** The lowest plan that opens a wall — what a 402 names, and where the link goes. */
export type PlanNeed = "plus" | "power";

const DEVICE_KEY = "lb-device";

/** The same id lib/track.ts sends with events. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

type Envelope<T> = { status: number; body: (T & { ok?: boolean; error?: string; need?: PlanNeed }) | null };

async function call<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const headers = new Headers(init.headers);
  headers.set(DEVICE_HEADER, deviceId());
  if (init.body) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  let body: Envelope<T>["body"] = null;
  try {
    body = (await res.json()) as Envelope<T>["body"];
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

type Failure = { ok: false; error: string; need?: PlanNeed };

function failure<T>(e: Envelope<T>, fallback: string): Failure {
  return {
    ok: false,
    error: e.body?.error ?? `${fallback} (${e.status})`,
    ...(e.status === 402 && e.body?.need ? { need: e.body.need } : {}),
  };
}

/* ── the judge ───────────────────────────────────────────────────────────── */

/** The hidden cases' INPUTS for a submit — their expectations stay on the server. */
export async function fetchHiddenCases(slug: string): Promise<{ ok: true; cases: { id: string; input: string }[] } | Failure> {
  try {
    const e = await call<{ cases: { id: string; input: string }[] }>(`/api/practice/${slug}/cases?mode=submit`);
    if (e.status === 200 && e.body?.ok && Array.isArray(e.body.cases)) return { ok: true, cases: e.body.cases };
    return failure(e, "could not fetch the hidden cases");
  } catch {
    return { ok: false, error: "could not reach the judge — check your connection" };
  }
}

export type SubmitInput = {
  lang: "python";
  mode: RunMode;
  code: string;
  outputs: CaseOutput[];
  error?: { title: string; detail: string };
};

export type ServerReport = {
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number;
  cases: CaseResult[];
  beats: number | null;
};

export type SubmitResult =
  | { ok: true; report: ServerReport; recorded: boolean; id: string | null; recordError?: string }
  | (Failure & { offline?: boolean });

/** Posts what the worker printed; the server compares and books the row. Every
    field is trimmed to the bounds lib/db/practice.ts enforces, so an
    exception with a very long message cannot turn a verdict into a 400. */
export async function submitOutputs(slug: string, input: SubmitInput): Promise<SubmitResult> {
  const body = {
    lang: input.lang,
    mode: input.mode,
    code: input.code,
    outputs: input.outputs.slice(0, 16).map((o) => ({
      id: o.id.slice(0, 8),
      got: o.got.slice(0, 4_000),
      ms: Number.isFinite(o.ms) ? Math.max(0, Math.min(600_000, o.ms)) : 0,
      ...(o.error ? { error: o.error.slice(0, 500) } : {}),
    })),
    ...(input.error ? { error: { title: input.error.title.slice(0, 80), detail: input.error.detail.slice(0, 500) } } : {}),
    device: deviceId(),
  };
  try {
    const e = await call<{ report: ServerReport; recorded: boolean; id: string | null; recordError?: string }>(
      `/api/practice/${slug}/submit`,
      { method: "POST", body: JSON.stringify(body) }
    );
    if (e.status === 200 && e.body?.ok && e.body.report) {
      return { ok: true, report: e.body.report, recorded: Boolean(e.body.recorded), id: e.body.id ?? null, ...(e.body.recordError ? { recordError: e.body.recordError } : {}) };
    }
    return failure(e, "the judge refused the submission");
  } catch {
    return { ok: false, offline: true, error: "could not reach the judge — check your connection" };
  }
}

/* ── the walkthrough ─────────────────────────────────────────────────────── */

export async function fetchEditorial(slug: string): Promise<{ ok: true; editorial: string[] | null; hints: string[] } | Failure> {
  try {
    const e = await call<{ editorial: string[] | null; hints: string[] }>(`/api/practice/${slug}/editorial`);
    if (e.status === 200 && e.body?.ok) return { ok: true, editorial: e.body.editorial ?? null, hints: e.body.hints ?? [] };
    return failure(e, "could not fetch the editorial");
  } catch {
    return { ok: false, error: "could not reach the server — check your connection" };
  }
}

/* ── acceptance ──────────────────────────────────────────────────────────── */

export type StatsResponse = { stats: Record<string, SlugStats>; minSubmissions: number; dbOk: boolean };

const STATS_TTL_MS = 60_000;
let statsCache: { at: number; data: StatsResponse } | null = null;
let statsInflight: Promise<StatsResponse> | null = null;

/** Per-slug submit / accepted counts, memoised for a minute per tab — the
    route caches for the same minute, so a re-fetch sooner returns the same. */
export function fetchStats(): Promise<StatsResponse> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return Promise.resolve(statsCache.data);
  if (statsInflight) return statsInflight;
  statsInflight = call<StatsResponse>("/api/practice/stats")
    .then((e) => {
      const data: StatsResponse =
        e.status === 200 && e.body?.ok
          ? { stats: e.body.stats ?? {}, minSubmissions: e.body.minSubmissions ?? 5, dbOk: Boolean(e.body.dbOk) }
          : { stats: {}, minSubmissions: 5, dbOk: false };
      statsCache = { at: Date.now(), data };
      return data;
    })
    .catch((): StatsResponse => ({ stats: {}, minSubmissions: 5, dbOk: false }))
    .finally(() => {
      statsInflight = null;
    });
  return statsInflight;
}

/** The acceptance rate (0–1) for a slug, or null until MIN submissions exist
    (or before the fetch lands). `loaded` tells a column to stop showing a
    placeholder and start showing "—" on purpose. */
export function useAcceptance(): { rateFor: (slug: string) => number | null; countFor: (slug: string) => number; loaded: boolean; minSubmissions: number } {
  const [data, setData] = useState<StatsResponse | null>(null);
  useEffect(() => {
    let alive = true;
    fetchStats().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  const min = data?.minSubmissions ?? 5;
  return {
    loaded: data !== null,
    minSubmissions: min,
    countFor: (slug) => data?.stats[slug]?.submissions ?? 0,
    rateFor: (slug) => {
      const s = data?.stats[slug];
      if (!s || s.submissions < min) return null;
      return s.accepted / s.submissions;
    },
  };
}

/* ── the weekly set ──────────────────────────────────────────────────────── */

export type ContestResponse = {
  set: { num: number; start: string; end: string; open: boolean; upcoming: boolean; durationMin: number; problems: string[] };
  rows: LeaderboardRow[];
  past: PastSet[];
  dbOk: boolean;
};

export async function fetchContest(set?: number): Promise<ContestResponse | null> {
  try {
    const e = await call<ContestResponse>(`/api/practice/contest${set ? `?set=${set}` : ""}`);
    if (e.status === 200 && e.body?.ok && e.body.set) return { set: e.body.set, rows: e.body.rows ?? [], past: e.body.past ?? [], dbOk: Boolean(e.body.dbOk) };
    return null;
  } catch {
    return null;
  }
}

/* ── the solver ──────────────────────────────────────────────────────────── */

export type MeResponse =
  | { anonymous: true; plan: Plan; limits: PlanLimits }
  | {
      anonymous: false;
      name: string | null;
      plan: Plan;
      limits: PlanLimits;
      /** null when the database could not be read (dbOk false). */
      progress: ProgressState | null;
      certificates: CertificateRecord[];
      dbOk: boolean;
    };

/** Throws on a network failure or a non-200 — the caller keeps its device ledger. */
export async function fetchMe(): Promise<MeResponse> {
  const e = await call<MeResponse>("/api/practice/me");
  if (e.status !== 200 || !e.body?.ok) throw new Error(e.body?.error ?? `me: ${e.status}`);
  return e.body as MeResponse;
}

export async function mintCertificate(
  track: TrackId
): Promise<{ ok: true; certificate: CertificateRecord; created: boolean } | (Failure & { missing?: string[]; status: number })> {
  try {
    const e = await call<{ certificate: CertificateRecord; created: boolean; missing?: string[] }>("/api/practice/certificate", {
      method: "POST",
      body: JSON.stringify({ track, device: deviceId() }),
    });
    if (e.status === 200 && e.body?.ok && e.body.certificate) return { ok: true, certificate: e.body.certificate, created: Boolean(e.body.created) };
    return { ...failure(e, "could not mint the certificate"), status: e.status, ...(e.body?.missing ? { missing: e.body.missing } : {}) };
  } catch {
    return { ok: false, status: 0, error: "could not reach the server — check your connection" };
  }
}
