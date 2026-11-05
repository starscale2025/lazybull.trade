// The admin cockpit's data CONTRACT — types, pure helpers, and the
// plain-English reasons a tile shows when its source does not exist yet.
//
// WHY this file was gutted. The 2026-09 diligence memo, verbatim: "The admin
// dashboard's KPIs (active sessions, paper trades, AI tokens) are seeded
// pseudo-random mocks. A real events pipeline into MongoDB exists with 15
// event types, but nothing aggregates it." This module WAS those mocks — a
// private mulberry32 PRNG, a NAMES array that invented users, a SYMBOLS array
// that invented their trades, a p99 latency series for a latency store that
// has never existed. All of it is deleted. Numbers on the cockpit now come
// from lib/admin-metrics.ts, which reads Mongo, or they do not appear at all.
//
// Types and pure functions ONLY. components/admin/* are client components and
// import from here, so this module must never pull in `mongodb` or `node:`.

/* ── time ────────────────────────────────────────────────────────────────── */

export const MIN_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

/** Midnight UTC of the day `ms` falls in. */
export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** Midnight UTC of the MONDAY of the week `ms` falls in. The epoch was a
    Thursday, so the naive floor(ms / WEEK) lands on Thursdays; the +3 day
    shift moves the boundary to Monday, which is what "signups by week" means
    to a person reading the chart. */
export function startOfUtcWeek(ms: number): number {
  return Math.floor((ms + 3 * DAY_MS) / WEEK_MS) * WEEK_MS - 3 * DAY_MS;
}

/** 0 when the denominator is 0 — a share of nothing is not NaN on screen. */
export function share(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/* ── empty-state copy ─────────────────────────────────────────────────────
   Each of these is a sentence a tile prints INSTEAD of a number, and each
   names the missing pipe so the reader knows what to build rather than
   wondering whether the product is dead. */

export const NO_ERROR_TELEMETRY =
  "no error store exists. app/api/csp-report writes violations to the server log, not to Mongo, and nothing else records failures as events — so this list would be fiction. Wire an error sink (or store csp_violation events) and it fills itself.";

export const NO_BOT_IDS =
  "quant_run_all, setup_applied and preset_applied carry a bot COUNT (props.bots), never a bot id — so which bots ran cannot be recovered from the stream. Per-bot attribution needs the workbench to emit an id (one event per bot, or a bot_ids prop).";

export const NO_GEO =
  "no event in the window carries a country. The server stamps ISO-2 from the platform geo header on schema-v2 events (lib/db/events.ts), so this fills in as v2 traffic lands — and stays empty on a host that sends no geo header.";

export const NO_SYMBOLS =
  "no order_submitted, bet_placed or bet_opened event in the window carries a symbol yet.";

export const NO_TRADES = "no paper trade has been placed in the window.";

export const NO_KILL_HISTORY =
  "no close_all event in the last 30 days. This panel arms a LOCAL drill only — there is no server-side kill switch to trip.";

export const HEALTH_SUBTITLE =
  "events per minute — the only real signal. There is no latency or error store, so the p99 and error series this chart used to draw were invented and have been removed.";

export const OFFLINE_NOTE =
  "Mongo is unreachable, so every number below would be a guess. Nothing is shown rather than something wrong.";

/* ── KPI strip ───────────────────────────────────────────────────────────── */

export type Tone = "bull" | "bear" | "amber" | "fg";

export type KpiCell = {
  k: string;
  v: number | string;
  unit?: string;
  /** Percent change against the previous equivalent window. Omitted — never
      zero-filled — when no honest prior window exists. */
  delta?: number;
  tone?: Tone;
  decimals?: number;
  spark?: number[];
  /** What the number literally counts. Printed under it. */
  sub?: string;
};

/* ── tiles ───────────────────────────────────────────────────────────────── */

export type HealthPoint = { t: number; events: number };

export type EventLevel = "info" | "warn" | "err" | "trade" | "auth" | "kill" | "ai";

/** One real row of the events collection, flattened for the stream tile.
    `who` is a short hash — the cockpit never needs to name a person. */
export type EventRow = {
  id: string;
  t: number;
  level: EventLevel;
  who: string;
  type: string;
  page: string | null;
  meta: string | null;
};

/** The visual language of the stream, keyed off REAL event names. Anything
    unrecognised is "info" — the tile never guesses a category. */
export function levelForType(type: string): EventLevel {
  switch (type) {
    case "order_submitted":
    case "bet_placed":
    case "bet_opened":
      return "trade";
    case "close_all":
    case "funds_reset":
      return "kill";
    case "explain_served":
      return "ai";
    case "signup":
    case "sign_in":
    case "sign_out":
    case "consent_given":
      return "auth";
    case "hit_paywall":
      return "warn";
    default:
      return "info";
  }
}

export type SymbolRow = { sym: string; trades: number; traders: number };
export type SymbolData = { rows: SymbolRow[]; windowDays: number; note: string | null };

export type BotRunRow = { id: string; label: string; runs: number; pct: number };
/** `rows` is empty until a bot id exists in the stream — see NO_BOT_IDS. The
    totals beside it are real, so the tile still says something true. */
export type BotRuns = { rows: BotRunRow[]; runs: number; botsEngaged: number; note: string | null };

export type TradeRow = {
  id: string;
  t: number;
  who: string;
  sym: string;
  kind: string;
  detail: string;
  country: string | null;
};
export type TradeFeed = { rows: TradeRow[]; note: string | null };

export type SignupBucket = { day: number; signups: number; activated: number };

export type GeoRow = { country: string; users: number };
export type GeoData = { rows: GeoRow[]; total: number; windowDays: number; note: string | null };

export type ErrorRow = { name: string; count: number; lastSeen: number; route: string };
export type ErrorData = { rows: ErrorRow[]; note: string | null };

export type FunnelStep = { label: string; count: number };

export type KillRow = { t: number; who: string; reason: string };
export type KillHistory = { rows: KillRow[]; note: string | null };

/* ── metric groups ───────────────────────────────────────────────────────── */

export type SignupMetrics = {
  /** 14 buckets, oldest first, midnight-UTC keyed. */
  daily: SignupBucket[];
  last7: number;
  prev7: number;
  last30: number;
  /** All-time `signup` events. */
  allTime: number;
  /** Rows in the Auth.js `users` collection — the fallback, and the honest
      cross-check: signup events only exist since the tracker shipped. */
  usersTotal: number;
};

export type ActivationMetrics = {
  /** Signups considered (last 30 days). */
  signups: number;
  /** Signups old enough for the question to be answerable. */
  eligible24h: number;
  within24h: number;
  rate24h: number;
  eligible7d: number;
  within7d: number;
  rate7d: number;
};

export type AudienceMetrics = { dau: number; wau: number; mau: number };

export type CohortRow = {
  weekStart: number;
  signups: number;
  /** Actives in weeks 1–4 after each member's own signup instant. */
  retained: [number, number, number, number];
  /** Cohort members active in ≥3 distinct weeks of their first 28 days. */
  threeWeekActive: number;
  /** Whole weeks elapsed since the cohort opened — a cell for week k is only
      answerable once this exceeds k. */
  weeksElapsed: number;
};

export type CohortMetrics = {
  /** Oldest first. */
  rows: CohortRow[];
  /** The memo's third number, over signups that have HAD 28 days to earn it. */
  threeWeekActive: { eligible: number; users: number; share: number };
};

export type PaperMetrics = {
  trades24h: number;
  prev24h: number;
  trades7d: number;
  traders24h: number;
  traders7d: number;
};

export type Tally = { key: string; n: number };

export type TeacherMetrics = {
  served24h: number;
  served7d: number;
  bySource: Tally[];
  byPlan: Tally[];
  paywall24h: number;
  paywall7d: number;
  paywallBySurface: Tally[];
};

export type PracticeMetrics = {
  runs: number;
  submits: number;
  accepted: number;
  users: number;
  top: Array<{ slug: string; submissions: number; accepted: number }>;
};

export type RevenueMetrics = {
  /** Monthly recurring revenue in USD, annual plans divided by 12. */
  mrrUsd: number;
  /** The share of mrrUsd that came from INR rows, after conversion. */
  mrrFromInrUsd: number;
  /** The same INR revenue in rupees — the sub-line, so nobody has to trust
      the conversion to read the Indian book. */
  mrrInrNative: number;
  inrPerUsd: number;
  active: number;
  byPlan: Tally[];
  byProvider: Tally[];
  newSubs30d: number;
  cancelled30d: number;
  waitlist: Array<{ tier: string; currency: string; n: number }>;
  waitlistTotal: number;
};

/* ── the whole page ──────────────────────────────────────────────────────── */

export type AdminMetrics = {
  /** false ⇒ Mongo could not be reached at all; every number below is zero. */
  ok: boolean;
  /** Metric groups whose own query failed while the database was reachable. */
  degraded: string[];
  error: string | null;
  generatedAt: number;
  kpis: KpiCell[];
  signups: SignupMetrics;
  activation: ActivationMetrics;
  audience: AudienceMetrics;
  cohorts: CohortMetrics;
  paper: PaperMetrics;
  teacher: TeacherMetrics;
  practice: PracticeMetrics;
  funnel: FunnelStep[];
  revenue: RevenueMetrics;
  geo: GeoData;
  stream: EventRow[];
  health: HealthPoint[];
  symbols: SymbolData;
  bots: BotRuns;
  errors: ErrorData;
  trades: TradeFeed;
  kill: KillHistory;
};

/* ── zero values ─────────────────────────────────────────────────────────
   One place that knows what "nothing" looks like, so an offline page and an
   empty database render the same honest zeros instead of two shapes. */

export function emptySignups(now: number): SignupMetrics {
  const today = startOfUtcDay(now);
  return {
    daily: Array.from({ length: 14 }, (_, i) => ({
      day: today - (13 - i) * DAY_MS,
      signups: 0,
      activated: 0,
    })),
    last7: 0,
    prev7: 0,
    last30: 0,
    allTime: 0,
    usersTotal: 0,
  };
}

export const EMPTY_ACTIVATION: ActivationMetrics = {
  signups: 0, eligible24h: 0, within24h: 0, rate24h: 0, eligible7d: 0, within7d: 0, rate7d: 0,
};

export const EMPTY_AUDIENCE: AudienceMetrics = { dau: 0, wau: 0, mau: 0 };

export const EMPTY_COHORTS: CohortMetrics = {
  rows: [],
  threeWeekActive: { eligible: 0, users: 0, share: 0 },
};

export const EMPTY_PAPER: PaperMetrics = {
  trades24h: 0, prev24h: 0, trades7d: 0, traders24h: 0, traders7d: 0,
};

export const EMPTY_TEACHER: TeacherMetrics = {
  served24h: 0, served7d: 0, bySource: [], byPlan: [], paywall24h: 0, paywall7d: 0, paywallBySurface: [],
};

export const EMPTY_PRACTICE: PracticeMetrics = {
  runs: 0, submits: 0, accepted: 0, users: 0, top: [],
};

/** The funnel's step LABELS are the contract ProFunnel renders; the counts are
    what Mongo says. An offline page keeps the steps and zeroes the counts, so
    the shape of the journey is still legible. */
export const FUNNEL_STEPS = [
  "Visited /trade",
  "Opened a bet",
  "Placed a trade",
  "Hit the paywall",
  "Started checkout",
  "Subscribed",
] as const;

export function emptyFunnel(): FunnelStep[] {
  return FUNNEL_STEPS.map((label) => ({ label, count: 0 }));
}

export function emptyRevenue(): RevenueMetrics {
  return {
    mrrUsd: 0, mrrFromInrUsd: 0, mrrInrNative: 0, inrPerUsd: 0,
    active: 0, byPlan: [], byProvider: [], newSubs30d: 0, cancelled30d: 0,
    waitlist: [], waitlistTotal: 0,
  };
}
