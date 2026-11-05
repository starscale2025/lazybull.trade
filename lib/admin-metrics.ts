// Real aggregates for the admin cockpit. This module is the answer to the
// 2026-09 diligence memo, verbatim: "A real events pipeline into MongoDB
// exists with 15 event types, but nothing aggregates it" and "Query the events
// collection. Signups by week, users with at least one paper trade within 24
// hours, users active in three separate weeks. Put the three numbers, whatever
// they are, on one page."
//
// Those three numbers are the first three cells of the KPI strip. Everything
// else on the page is built the same way: one bounded query per question, all
// of them fired together, and NOTHING invented. Where a source does not exist
// — there is no latency store, no error store, and no bot id in the quant
// events — the tile gets an empty state naming the missing pipe instead of a
// plausible number. A wrong number on this page is worse than no number: it is
// what the memo caught us shipping.
//
// Every function takes `now` explicitly so the suite can pin a clock, and
// every one returns plain JSON — no Mongo cursors escape this file.
//
// COST. Each query is bounded by a createdAt window and a row cap. The events
// collection is indexed {userId, createdAt} and {type, createdAt}
// (lib/db/events.ts), which covers the by-type windows; the live stream sorts
// on createdAt alone and would want an index of its own once the collection is
// large — see the note on liveStream().

import { createHash } from "node:crypto";
import type { Document, ObjectId } from "mongodb";
import { db } from "./mongo";
import { entitles } from "./billing/entitlements";
import { ENTITLING_STATUSES, type SubscriptionDoc } from "./billing/types";
import {
  DAY_MS,
  EMPTY_ACTIVATION,
  EMPTY_AUDIENCE,
  EMPTY_COHORTS,
  EMPTY_PAPER,
  EMPTY_PRACTICE,
  EMPTY_TEACHER,
  FUNNEL_STEPS,
  MIN_MS,
  NO_BOT_IDS,
  NO_ERROR_TELEMETRY,
  NO_GEO,
  NO_KILL_HISTORY,
  NO_SYMBOLS,
  NO_TRADES,
  WEEK_MS,
  emptyFunnel,
  emptyRevenue,
  emptySignups,
  levelForType,
  share,
  startOfUtcDay,
  startOfUtcWeek,
  type ActivationMetrics,
  type AdminMetrics,
  type AudienceMetrics,
  type BotRuns,
  type CohortMetrics,
  type CohortRow,
  type ErrorData,
  type EventRow,
  type FunnelStep,
  type GeoData,
  type HealthPoint,
  type KillHistory,
  type KpiCell,
  type PaperMetrics,
  type PracticeMetrics,
  type RevenueMetrics,
  type SignupMetrics,
  type SymbolData,
  type Tally,
  type TeacherMetrics,
  type TradeFeed,
} from "./admin-data";

/* ── shapes we READ (lib/db/* own the writes) ────────────────────────────── */

type EventReadDoc = {
  _id: ObjectId;
  userId?: ObjectId;
  device?: string;
  type: string;
  page?: string;
  props?: Record<string, unknown>;
  sv?: number;
  country?: string;
  clientTs?: number;
  createdAt: Date;
};

type SubmissionReadDoc = {
  userId?: ObjectId;
  device?: string;
  slug: string;
  mode: string;
  verdict: string;
  createdAt: Date;
};

/* ── constants ───────────────────────────────────────────────────────────── */

/** A paper trade, as the product emits it (lib/stores.ts, components/bet). */
const TRADE_TYPES = ["order_submitted", "bet_placed"] as const;
/** …plus the multi-leg builder, which names its symbol `underlying`. */
const SYMBOL_TYPES = ["order_submitted", "bet_placed", "bet_opened"] as const;
const QUANT_TYPES = ["quant_run_all", "setup_applied", "preset_applied"] as const;

/** How many signup rows one cohort/activation pass will pull. Far above any
    plausible weekly volume here; it exists so a viral week cannot turn the
    cockpit into an OOM. */
const MAX_SIGNUP_ROWS = 20_000;
const STREAM_ROWS = 80;
const HEALTH_MINUTES = 90;
const GEO_TOP = 12;
const SYMBOL_TOP = 12;
const TRADE_FEED_ROWS = 18;

/**
 * One actor: the signed-in user when we have one, else the anonymous device
 * id. `$toString` of a missing userId is null, so `$ifNull` falls through
 * exactly once. Events with neither are dropped by every caller — they cannot
 * be counted as a person without double-counting.
 */
const ACTOR: Document = { $ifNull: [{ $toString: "$userId" }, "$device"] };

const DEFAULT_INR_PER_USD = 84;
/** Read at CALL time: a rate correction must not need a redeploy. */
function inrPerUsd(): number {
  const raw = Number(process.env.LAZYBULL_INR_PER_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INR_PER_USD;
}

async function eventsColl() {
  return (await db()).collection<EventReadDoc>("events");
}

const first = (rows: Array<{ n: number }> | undefined): number => rows?.[0]?.n ?? 0;
const tally = (rows: Array<{ _id: unknown; n: number }>): Tally[] =>
  rows
    .map((r) => ({ key: r._id == null ? "—" : String(r._id).slice(0, 32), n: r.n }))
    .sort((a, b) => b.n - a.n);

/* ── 1 + 2. signups, and the memo's "traded within 24 hours" ─────────────── */

/**
 * Signups per day (14d) and activation, together — deliberately one function,
 * because activation is a property OF the signup rows and fetching them twice
 * would double the cost of the page's most expensive query.
 *
 * The activation denominator is not "all signups": a person who signed up an
 * hour ago has not had 24 hours to trade, and counting them as un-activated
 * would drag the rate down every time growth accelerates. So each rate is
 * measured only over signups old enough to have answered the question.
 */
export async function signupsAndActivation(
  now: Date,
): Promise<{ signups: SignupMetrics; activation: ActivationMetrics }> {
  const t = now.getTime();
  const c = await eventsColl();
  const d30 = new Date(t - 30 * DAY_MS);
  const from14 = startOfUtcDay(t) - 13 * DAY_MS;

  const [rows, allTime, usersTotal, prev7] = await Promise.all([
    c
      .find({ type: "signup", createdAt: { $gte: d30 } }, { projection: { userId: 1, createdAt: 1 } })
      .limit(MAX_SIGNUP_ROWS)
      .toArray(),
    c.countDocuments({ type: "signup" }),
    (await db()).collection("users").countDocuments().catch(() => 0),
    c.countDocuments({ type: "signup", createdAt: { $gte: new Date(t - 14 * DAY_MS), $lt: new Date(t - 7 * DAY_MS) } }),
  ]);

  // The first trade each of those users ever made inside the window. One
  // aggregation for every signup, rather than a query per user.
  const ids = rows.map((r) => r.userId).filter((x): x is ObjectId => !!x);
  const firstTrade = new Map<string, number>();
  if (ids.length) {
    const agg = await c
      .aggregate<{ _id: ObjectId; first: Date }>([
        { $match: { type: { $in: [...TRADE_TYPES] }, userId: { $in: ids }, createdAt: { $gte: d30 } } },
        { $group: { _id: "$userId", first: { $min: "$createdAt" } } },
      ])
      .toArray();
    for (const r of agg) firstTrade.set(r._id.toHexString(), r.first.getTime());
  }

  const daily = Array.from({ length: 14 }, (_, i) => ({
    day: from14 + i * DAY_MS,
    signups: 0,
    activated: 0,
  }));
  let last7 = 0;
  let last30 = 0;
  const act = { ...EMPTY_ACTIVATION };

  for (const r of rows) {
    const at = r.createdAt.getTime();
    last30++;
    if (at >= t - 7 * DAY_MS) last7++;
    act.signups++;

    // A trade only counts if it happened AFTER the signup. One minute of slack
    // absorbs clock skew between the auth event and the tracker's batch.
    const trade = r.userId ? firstTrade.get(r.userId.toHexString()) : undefined;
    const delta = trade != null ? trade - at : Infinity;
    const traded = delta >= -MIN_MS;

    if (at <= t - DAY_MS) {
      act.eligible24h++;
      if (traded && delta <= DAY_MS) act.within24h++;
    }
    if (at <= t - 7 * DAY_MS) {
      act.eligible7d++;
      if (traded && delta <= 7 * DAY_MS) act.within7d++;
    }

    const bucket = Math.floor((startOfUtcDay(at) - from14) / DAY_MS);
    if (bucket >= 0 && bucket < daily.length) {
      daily[bucket].signups++;
      if (traded && delta <= DAY_MS) daily[bucket].activated++;
    }
  }

  act.rate24h = share(act.within24h, act.eligible24h);
  act.rate7d = share(act.within7d, act.eligible7d);

  return {
    signups: { daily, last7, prev7, last30, allTime, usersTotal },
    activation: act,
  };
}

/* ── 3. DAU / WAU / MAU ──────────────────────────────────────────────────── */

/** Distinct actors with any event in the last 1 / 7 / 30 days. One pass: the
    30-day grouping is computed once and the shorter windows are filtered off
    each actor's most recent event. */
export async function audienceMetrics(now: Date): Promise<AudienceMetrics> {
  const t = now.getTime();
  const c = await eventsColl();
  const [out] = await c
    .aggregate<{ dau: Array<{ n: number }>; wau: Array<{ n: number }>; mau: Array<{ n: number }> }>([
      { $match: { createdAt: { $gte: new Date(t - 30 * DAY_MS) } } },
      { $group: { _id: ACTOR, last: { $max: "$createdAt" } } },
      { $match: { _id: { $ne: null } } },
      {
        $facet: {
          mau: [{ $count: "n" }],
          wau: [{ $match: { last: { $gte: new Date(t - 7 * DAY_MS) } } }, { $count: "n" }],
          dau: [{ $match: { last: { $gte: new Date(t - DAY_MS) } } }, { $count: "n" }],
        },
      },
    ])
    .toArray();
  if (!out) return EMPTY_AUDIENCE;
  return { dau: first(out.dau), wau: first(out.wau), mau: first(out.mau) };
}

/* ── 4. weekly cohorts, and the memo's "three separate weeks" ────────────── */

/**
 * Eight signup cohorts, retention in weeks 1–4, and the share of signups
 * active in ≥3 distinct weeks of their first month.
 *
 * Weeks are measured from each person's OWN signup instant, not from the
 * calendar — "still here a week later" is a fact about them, not about
 * Mondays. Activity is reduced to distinct (user, day) pairs in Mongo so the
 * page never pulls a row per page_view.
 *
 * The headline share counts only cohorts that have HAD 28 days to earn it:
 * a person who signed up on Tuesday cannot have been active in three weeks,
 * and including them would make the number a function of recent growth.
 */
export async function cohortMetrics(now: Date): Promise<CohortMetrics> {
  const t = now.getTime();
  const c = await eventsColl();
  const thisWeek = startOfUtcWeek(t);
  const from = thisWeek - 7 * WEEK_MS;

  const signups = await c
    .find({ type: "signup", createdAt: { $gte: new Date(from) } }, { projection: { userId: 1, createdAt: 1 } })
    .limit(MAX_SIGNUP_ROWS)
    .toArray();
  const ids = signups.map((s) => s.userId).filter((x): x is ObjectId => !!x);
  if (!ids.length) return EMPTY_COHORTS;

  const days = await c
    .aggregate<{ _id: { u: ObjectId; d: Date } }>([
      { $match: { userId: { $in: ids }, createdAt: { $gte: new Date(from) } } },
      { $group: { _id: { u: "$userId", d: { $dateTrunc: { date: "$createdAt", unit: "day" } } } } },
    ])
    .toArray();

  const activeDays = new Map<string, number[]>();
  for (const r of days) {
    const k = r._id.u.toHexString();
    const list = activeDays.get(k);
    if (list) list.push(r._id.d.getTime());
    else activeDays.set(k, [r._id.d.getTime()]);
  }

  const byWeek = new Map<number, CohortRow>();
  for (let i = 0; i < 8; i++) {
    const weekStart = from + i * WEEK_MS;
    byWeek.set(weekStart, {
      weekStart,
      signups: 0,
      retained: [0, 0, 0, 0],
      threeWeekActive: 0,
      weeksElapsed: Math.floor((t - weekStart) / WEEK_MS),
    });
  }

  let eligible = 0;
  let threeWeek = 0;
  for (const s of signups) {
    const at = s.createdAt.getTime();
    const row = byWeek.get(startOfUtcWeek(at));
    if (!row) continue;
    row.signups++;

    const weeks = new Set<number>();
    for (const d of (s.userId && activeDays.get(s.userId.toHexString())) || []) {
      // A day bucket can start before the signup instant (signing up at 23:00
      // truncates to that morning); clamp instead of dropping same-day life.
      const w = Math.max(0, Math.floor((d - at) / WEEK_MS));
      weeks.add(w);
    }
    for (let k = 1; k <= 4; k++) if (weeks.has(k)) row.retained[k - 1]++;

    const firstMonth = [0, 1, 2, 3].filter((w) => weeks.has(w)).length;
    if (firstMonth >= 3) row.threeWeekActive++;
    if (at <= t - 28 * DAY_MS) {
      eligible++;
      if (firstMonth >= 3) threeWeek++;
    }
  }

  return {
    rows: [...byWeek.values()].sort((a, b) => a.weekStart - b.weekStart),
    threeWeekActive: { eligible, users: threeWeek, share: share(threeWeek, eligible) },
  };
}

/* ── 5. paper trades ─────────────────────────────────────────────────────── */

export async function paperMetrics(now: Date): Promise<PaperMetrics> {
  const t = now.getTime();
  const c = await eventsColl();
  const d1 = new Date(t - DAY_MS);
  const d2 = new Date(t - 2 * DAY_MS);
  const d7 = new Date(t - 7 * DAY_MS);
  const [out] = await c
    .aggregate<Record<string, Array<{ n: number }>>>([
      { $match: { type: { $in: [...TRADE_TYPES] }, createdAt: { $gte: d7 } } },
      { $project: { createdAt: 1, actor: ACTOR } },
      {
        $facet: {
          trades24h: [{ $match: { createdAt: { $gte: d1 } } }, { $count: "n" }],
          prev24h: [{ $match: { createdAt: { $gte: d2, $lt: d1 } } }, { $count: "n" }],
          trades7d: [{ $count: "n" }],
          traders24h: [
            { $match: { createdAt: { $gte: d1 }, actor: { $ne: null } } },
            { $group: { _id: "$actor" } },
            { $count: "n" },
          ],
          traders7d: [{ $match: { actor: { $ne: null } } }, { $group: { _id: "$actor" } }, { $count: "n" }],
        },
      },
    ])
    .toArray();
  if (!out) return EMPTY_PAPER;
  return {
    trades24h: first(out.trades24h),
    prev24h: first(out.prev24h),
    trades7d: first(out.trades7d),
    traders24h: first(out.traders24h),
    traders7d: first(out.traders7d),
  };
}

/* ── 6. AI teacher ───────────────────────────────────────────────────────── */

/** explain_served split by source and plan, and hit_paywall by surface. Note
    what is NOT here: token counts. app/api/explain logs {source, plan} and no
    usage figure, so the old "ai teacher tokens · 2.1M" KPI had nothing behind
    it at all and is gone rather than guessed. */
export async function teacherMetrics(now: Date): Promise<TeacherMetrics> {
  const t = now.getTime();
  const c = await eventsColl();
  const d1 = new Date(t - DAY_MS);
  const d7 = new Date(t - 7 * DAY_MS);
  const served = { type: "explain_served" };
  const paywall = { type: "hit_paywall" };
  const [out] = await c
    .aggregate<{
      served24h: Array<{ n: number }>;
      served7d: Array<{ n: number }>;
      bySource: Array<{ _id: unknown; n: number }>;
      byPlan: Array<{ _id: unknown; n: number }>;
      paywall24h: Array<{ n: number }>;
      paywall7d: Array<{ n: number }>;
      paywallBySurface: Array<{ _id: unknown; n: number }>;
    }>([
      { $match: { type: { $in: ["explain_served", "hit_paywall"] }, createdAt: { $gte: d7 } } },
      {
        $facet: {
          served24h: [{ $match: { ...served, createdAt: { $gte: d1 } } }, { $count: "n" }],
          served7d: [{ $match: served }, { $count: "n" }],
          bySource: [{ $match: served }, { $group: { _id: "$props.source", n: { $sum: 1 } } }],
          byPlan: [{ $match: served }, { $group: { _id: "$props.plan", n: { $sum: 1 } } }],
          paywall24h: [{ $match: { ...paywall, createdAt: { $gte: d1 } } }, { $count: "n" }],
          paywall7d: [{ $match: paywall }, { $count: "n" }],
          paywallBySurface: [{ $match: paywall }, { $group: { _id: "$props.surface", n: { $sum: 1 } } }],
        },
      },
    ])
    .toArray();
  if (!out) return EMPTY_TEACHER;
  return {
    served24h: first(out.served24h),
    served7d: first(out.served7d),
    bySource: tally(out.bySource),
    byPlan: tally(out.byPlan),
    paywall24h: first(out.paywall24h),
    paywall7d: first(out.paywall7d),
    paywallBySurface: tally(out.paywallBySurface),
  };
}

/* ── 7. practice ─────────────────────────────────────────────────────────── */

/** Straight from `practice_submissions` — the judge's own ledger, not the
    client's practice_run/practice_verdict events, because the ledger is what
    /practice already prints acceptance rates from. The per-slug $group is the
    same shape as statsFor() in lib/db/practice.ts; it is repeated here only
    because statsFor takes a slug list and no time window, and the cockpit
    needs the reverse — a window, and whichever slugs win it. */
export async function practiceMetrics(now: Date): Promise<PracticeMetrics> {
  const t = now.getTime();
  const c = (await db()).collection<SubmissionReadDoc>("practice_submissions");
  const [out] = await c
    .aggregate<{
      runs: Array<{ n: number }>;
      submits: Array<{ n: number }>;
      accepted: Array<{ n: number }>;
      users: Array<{ n: number }>;
      top: Array<{ _id: string; submissions: number; accepted: number }>;
    }>([
      { $match: { createdAt: { $gte: new Date(t - 7 * DAY_MS) } } },
      { $project: { slug: 1, mode: 1, verdict: 1, actor: ACTOR } },
      {
        $facet: {
          runs: [{ $match: { mode: "run" } }, { $count: "n" }],
          submits: [{ $match: { mode: "submit" } }, { $count: "n" }],
          accepted: [{ $match: { mode: "submit", verdict: "accepted" } }, { $count: "n" }],
          users: [{ $match: { actor: { $ne: null } } }, { $group: { _id: "$actor" } }, { $count: "n" }],
          top: [
            { $match: { mode: "submit" } },
            {
              $group: {
                _id: "$slug",
                submissions: { $sum: 1 },
                accepted: { $sum: { $cond: [{ $eq: ["$verdict", "accepted"] }, 1, 0] } },
              },
            },
            { $sort: { submissions: -1, _id: 1 } },
            { $limit: 5 },
          ],
        },
      },
    ])
    .toArray();
  if (!out) return EMPTY_PRACTICE;
  return {
    runs: first(out.runs),
    submits: first(out.submits),
    accepted: first(out.accepted),
    users: first(out.users),
    top: out.top.map((r) => ({ slug: r._id, submissions: r.submissions, accepted: r.accepted })),
  };
}

/* ── 8. the funnel ───────────────────────────────────────────────────────── */

/**
 * Distinct actors, 30 days, at each step from landing on /trade to paying.
 *
 * The steps are NOT nested — a person can hit the paywall on /practice without
 * ever opening a bet — so a later step can out-count an earlier one. That is a
 * finding, not a bug, and ProFunnel now shows a rise as a rise instead of a
 * negative "drop". The old seeded version could never show it, because it
 * built each step by multiplying the last one by a decay constant.
 */
export async function funnelMetrics(now: Date): Promise<FunnelStep[]> {
  const c = await eventsColl();
  const from = new Date(now.getTime() - 30 * DAY_MS);
  const distinct = (match: Document): Document[] => [{ $match: match }, { $group: { _id: "$actor" } }, { $count: "n" }];
  const [out] = await c
    .aggregate<Record<string, Array<{ n: number }>>>([
      { $match: { createdAt: { $gte: from } } },
      { $project: { type: 1, page: 1, actor: ACTOR } },
      { $match: { actor: { $ne: null } } },
      {
        $facet: {
          visited: distinct({ type: "page_view", page: { $regex: "^/trade" } }),
          opened: distinct({ type: "bet_opened" }),
          placed: distinct({ type: { $in: [...TRADE_TYPES] } }),
          paywall: distinct({ type: "hit_paywall" }),
          checkout: distinct({ type: "checkout_started" }),
          subscribed: distinct({ type: "subscription_started" }),
        },
      },
    ])
    .toArray();
  if (!out) return emptyFunnel();
  const counts = [
    first(out.visited),
    first(out.opened),
    first(out.placed),
    first(out.paywall),
    first(out.checkout),
    first(out.subscribed),
  ];
  return FUNNEL_STEPS.map((label, i) => ({ label, count: counts[i] }));
}

/* ── 9. revenue ──────────────────────────────────────────────────────────── */

/**
 * MRR from the `subscriptions` collection, not from the checkout events: a
 * started checkout is not money, and a cancelled sub keeps its row.
 * `entitles()` from lib/billing/entitlements is the SAME predicate the paywall
 * uses, reused rather than re-expressed — the cockpit must not be able to
 * disagree with the product about who is paying.
 *
 * Annual plans are divided by 12. INR is converted at LAZYBULL_INR_PER_USD so
 * one number can be read, and the rupee total is carried alongside so the
 * Indian book can be read without trusting the rate.
 */
export async function revenueMetrics(now: Date): Promise<RevenueMetrics> {
  const t = now.getTime();
  const d30 = new Date(t - 30 * DAY_MS);
  const database = await db();
  const subs = database.collection<SubscriptionDoc>("subscriptions");
  const rate = inrPerUsd();

  const [rows, newSubs30d, cancelled30d, waitRows] = await Promise.all([
    subs
      .find(
        { status: { $in: [...ENTITLING_STATUSES] } },
        { projection: { plan: 1, provider: 1, currency: 1, amountMinor: 1, interval: 1, status: 1, currentPeriodEnd: 1 } },
      )
      .limit(50_000)
      .toArray(),
    subs.countDocuments({ createdAt: { $gte: d30 } }),
    subs.countDocuments({ cancelledAt: { $gte: d30 } }),
    database
      .collection("waitlist")
      .aggregate<{ _id: { tier: string; currency: string }; n: number }>([
        { $group: { _id: { tier: "$tier", currency: "$currency" }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ])
      .toArray()
      .catch(() => []),
  ]);

  const live = rows.filter((r) => entitles(r, t));
  let mrrUsd = 0;
  let mrrFromInrUsd = 0;
  let mrrInrNative = 0;
  const plans = new Map<string, number>();
  const providers = new Map<string, number>();
  for (const r of live) {
    const minor = Number(r.amountMinor) || 0;
    const monthlyMajor = (r.interval === "year" ? minor / 12 : minor) / 100;
    if (r.currency === "INR") {
      const usd = monthlyMajor / rate;
      mrrUsd += usd;
      mrrFromInrUsd += usd;
      mrrInrNative += monthlyMajor;
    } else {
      mrrUsd += monthlyMajor;
    }
    plans.set(r.plan, (plans.get(r.plan) ?? 0) + 1);
    providers.set(r.provider, (providers.get(r.provider) ?? 0) + 1);
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    mrrUsd: round2(mrrUsd),
    mrrFromInrUsd: round2(mrrFromInrUsd),
    mrrInrNative: round2(mrrInrNative),
    inrPerUsd: rate,
    active: live.length,
    byPlan: tally([...plans].map(([key, n]) => ({ _id: key, n }))),
    byProvider: tally([...providers].map(([key, n]) => ({ _id: key, n }))),
    newSubs30d,
    cancelled30d,
    waitlist: waitRows.map((r) => ({
      tier: String(r._id?.tier ?? "—"),
      currency: String(r._id?.currency ?? "—"),
      n: r.n,
    })),
    waitlistTotal: waitRows.reduce((a, b) => a + b.n, 0),
  };
}

/* ── 10. geo ─────────────────────────────────────────────────────────────── */

/** Distinct actors per ISO-2 country over 7 days. The country is stamped
    server-side on schema-v2 events; v1 rows carry none, and a host that sends
    no geo header never will — hence the empty state rather than a map of
    invented cities, which is what this tile used to draw. */
export async function geoMetrics(now: Date): Promise<GeoData> {
  const c = await eventsColl();
  const rows = await c
    .aggregate<{ _id: string; n: number }>([
      {
        $match: {
          createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) },
          country: { $type: "string" },
        },
      },
      { $project: { country: 1, actor: ACTOR } },
      { $match: { actor: { $ne: null } } },
      { $group: { _id: { c: "$country", a: "$actor" } } },
      { $group: { _id: "$_id.c", n: { $sum: 1 } } },
      { $sort: { n: -1, _id: 1 } },
      { $limit: GEO_TOP },
    ])
    .toArray();
  return {
    rows: rows.map((r) => ({ country: r._id, users: r.n })),
    total: rows.reduce((a, b) => a + b.n, 0),
    windowDays: 7,
    note: rows.length ? null : NO_GEO,
  };
}

/* ── 11. the live stream ─────────────────────────────────────────────────── */

/** Stable, non-reversing 6 hex chars. The cockpit needs to see that two rows
    are the same person; it never needs to know which person, so no name, no
    email and no raw id crosses into the client bundle. */
function hash6(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 6);
}

/** Whitelisted, in the order a human scans them. Values are already capped at
    400 chars by the ingest schema; 20 is what fits the column. */
const PROP_KEYS = [
  "sym", "underlying", "symbol", "slug", "side", "dir", "qty", "stake", "strategy",
  "mode", "source", "plan", "surface", "tier", "currency", "provider", "status",
  "reason", "verdict", "lang", "bots", "need", "to", "count",
];

function propSummary(props?: Record<string, unknown>): string | null {
  if (!props) return null;
  const parts: string[] = [];
  for (const k of PROP_KEYS) {
    if (parts.length >= 3) break;
    const v = props[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}=${String(v).slice(0, 20)}`);
  }
  return parts.length ? parts.join(" ") : null;
}

/**
 * The last 80 events, as they were written. No templates, no invented names,
 * no synthetic tail — this replaces a tile that manufactured a fresh "trade"
 * every 2.5 seconds from a list of twelve message templates.
 *
 * Bounded to 7 days so the sort has a ceiling. The events indexes are
 * {userId, createdAt} and {type, createdAt}, neither of which is a prefix on
 * createdAt alone, so this is the one query on the page that will want an
 * index of its own once the collection is large: {createdAt: -1}.
 */
export async function liveStream(now: Date): Promise<EventRow[]> {
  const c = await eventsColl();
  const rows = await c
    .find(
      { createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } },
      { projection: { type: 1, page: 1, props: 1, userId: 1, device: 1, country: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(STREAM_ROWS)
    .toArray();
  return rows.map((r) => ({
    id: r._id.toHexString(),
    t: r.createdAt.getTime(),
    level: levelForType(r.type),
    who: r.userId ? `u·${hash6(r.userId.toHexString())}` : r.device ? `d·${hash6(r.device)}` : "server",
    type: r.type,
    page: r.page ?? null,
    meta: propSummary(r.props),
  }));
}

/* ── 12. health ──────────────────────────────────────────────────────────── */

/** Events per minute for the last 90 minutes — the whole of what this host
    can honestly say about itself. There is no request log, no latency
    histogram and no error counter behind this page, so the p99 and error
    series the chart used to draw were pure PRNG output and are deleted. */
export async function healthSeries(now: Date): Promise<HealthPoint[]> {
  const c = await eventsColl();
  const end = Math.floor(now.getTime() / MIN_MS) * MIN_MS;
  const start = end - (HEALTH_MINUTES - 1) * MIN_MS;
  const rows = await c
    .aggregate<{ _id: Date; n: number }>([
      { $match: { createdAt: { $gte: new Date(start) } } },
      { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "minute" } }, n: { $sum: 1 } } },
    ])
    .toArray();
  const byMinute = new Map(rows.map((r) => [r._id.getTime(), r.n]));
  return Array.from({ length: HEALTH_MINUTES }, (_, i) => {
    const t = start + i * MIN_MS;
    return { t, events: byMinute.get(t) ?? 0 };
  });
}

/* ── 13. symbols ─────────────────────────────────────────────────────────── */

/** Top traded symbols over 7 days. The prop key is `sym` on order_submitted
    and bet_placed, `underlying` on bet_opened — the multi-leg builder names it
    differently, so both are read. 7 days, not 24 hours: at this volume a
    24-hour tile is usually empty and an empty tile teaches nothing. */
export async function symbolMetrics(now: Date): Promise<SymbolData> {
  const c = await eventsColl();
  const rows = await c
    .aggregate<{ _id: string; trades: number; traders: number }>([
      { $match: { type: { $in: [...SYMBOL_TYPES] }, createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } } },
      { $project: { sym: { $ifNull: ["$props.sym", "$props.underlying"] }, actor: ACTOR } },
      { $match: { sym: { $type: "string" } } },
      { $group: { _id: "$sym", trades: { $sum: 1 }, actors: { $addToSet: "$actor" } } },
      {
        $project: {
          trades: 1,
          traders: { $size: { $filter: { input: "$actors", cond: { $ne: ["$$this", null] } } } },
        },
      },
      { $sort: { trades: -1, _id: 1 } },
      { $limit: SYMBOL_TOP },
    ])
    .toArray();
  return {
    rows: rows.map((r) => ({ sym: String(r._id).slice(0, 12), trades: r.trades, traders: r.traders })),
    windowDays: 7,
    note: rows.length ? null : NO_SYMBOLS,
  };
}

/* ── 14. quant bots ──────────────────────────────────────────────────────── */

/** The honest answer is "we cannot tell". quant_run_all carries how MANY bots
    ran, never which — so the twelve-row leaderboard this tile used to show
    (with real bot names against PRNG run counts) was the most convincing lie
    on the page. What survives is the pair of numbers the props do support. */
export async function botMetrics(now: Date): Promise<BotRuns> {
  const c = await eventsColl();
  const rows = await c
    .aggregate<{ _id: string; n: number; bots: number }>([
      { $match: { type: { $in: [...QUANT_TYPES] }, createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } } },
      { $group: { _id: "$type", n: { $sum: 1 }, bots: { $sum: { $ifNull: ["$props.bots", 0] } } } },
    ])
    .toArray();
  const runs = rows.reduce((a, b) => a + b.n, 0);
  const botsEngaged = rows.reduce((a, b) => a + (Number(b.bots) || 0), 0);
  return { rows: [], runs, botsEngaged, note: NO_BOT_IDS };
}

/* ── 15. errors ──────────────────────────────────────────────────────────── */

/** Queried anyway, so the tile lights up the day someone stores violations as
    events — but nothing writes `csp_violation` today (app/api/csp-report
    console.warns and returns 204), so the expected answer is an empty state.
    The previous version listed six invented error names against invented
    counts, complete with plausible routes. */
export async function errorMetrics(now: Date): Promise<ErrorData> {
  const c = await eventsColl();
  const rows = await c
    .aggregate<{ _id: unknown; count: number; lastSeen: Date; route: unknown }>([
      { $match: { type: "csp_violation", createdAt: { $gte: new Date(now.getTime() - DAY_MS) } } },
      {
        $group: {
          _id: { $ifNull: ["$props.directive", "csp_violation"] },
          count: { $sum: 1 },
          lastSeen: { $max: "$createdAt" },
          route: { $last: "$page" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ])
    .toArray();
  return {
    rows: rows.map((r) => ({
      name: String(r._id).slice(0, 48),
      count: r.count,
      lastSeen: r.lastSeen.getTime(),
      route: r.route ? String(r.route).slice(0, 48) : "—",
    })),
    note: rows.length ? null : NO_ERROR_TELEMETRY,
  };
}

/* ── recent paper trades, and the kill-switch log ────────────────────────── */

/** The trade feed, rebuilt from events. There is no P/L column any more: the
    events carry the ORDER, not its outcome, and paper_accounts stores each
    account's ledger as an opaque client blob (lib/db/paper.ts) that the
    cockpit cannot honestly total. The old table showed a p/l per row. */
export async function tradeFeed(now: Date): Promise<TradeFeed> {
  const c = await eventsColl();
  const rows = await c
    .find(
      { type: { $in: [...SYMBOL_TYPES] }, createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } },
      { projection: { type: 1, props: 1, userId: 1, device: 1, country: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(TRADE_FEED_ROWS)
    .toArray();
  return {
    rows: rows.map((r) => {
      const p = r.props ?? {};
      const sym = String(p.sym ?? p.underlying ?? "—").slice(0, 12);
      const detail =
        r.type === "bet_placed"
          ? `${p.dir ?? "?"} · $${p.stake ?? "?"}`
          : r.type === "bet_opened"
            ? `${p.strategy ?? "?"} · ${p.legs ?? "?"} legs`
            : `${p.side ?? "?"} ${p.qty ?? "?"} · ${p.type ?? "?"} · ${p.mode ?? "?"}`;
      return {
        id: r._id.toHexString(),
        t: r.createdAt.getTime(),
        who: r.userId ? `u·${hash6(r.userId.toHexString())}` : r.device ? `d·${hash6(r.device)}` : "server",
        sym,
        kind: r.type,
        detail: detail.slice(0, 48),
        country: r.country ?? null,
      };
    }),
    note: rows.length ? null : NO_TRADES,
  };
}

/** Real close_all events — the only kill-shaped fact the product records. The
    panel's own history list used to be three hardcoded strings ("12 min ago ·
    daily loss limit · auto") that never changed. */
export async function killHistory(now: Date): Promise<KillHistory> {
  const c = await eventsColl();
  const rows = await c
    .find(
      { type: "close_all", createdAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) } },
      { projection: { props: 1, userId: 1, device: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(8)
    .toArray();
  return {
    rows: rows.map((r) => ({
      t: r.createdAt.getTime(),
      who: r.userId ? `u·${hash6(r.userId.toHexString())}` : r.device ? `d·${hash6(r.device)}` : "server",
      reason: String(r.props?.reason ?? "—").slice(0, 40),
    })),
    note: rows.length ? null : NO_KILL_HISTORY,
  };
}

/* ── the page ────────────────────────────────────────────────────────────── */

async function safe<T>(name: string, fallback: T, fn: () => Promise<T>, degraded: string[]): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // One slow or malformed collection must not blank the whole cockpit; the
    // page names which group went dark instead of quietly showing its zeros.
    console.warn(`admin-metrics: ${name} failed —`, (err as Error)?.message);
    degraded.push(name);
    return fallback;
  }
}

/** Zeros, an offline flag, and the reason — never seeded numbers. */
export function offlineMetrics(now: Date, error: string): AdminMetrics {
  const t = now.getTime();
  return {
    ok: false,
    degraded: [],
    error,
    generatedAt: t,
    kpis: [],
    signups: emptySignups(t),
    activation: EMPTY_ACTIVATION,
    audience: EMPTY_AUDIENCE,
    cohorts: EMPTY_COHORTS,
    paper: EMPTY_PAPER,
    teacher: EMPTY_TEACHER,
    practice: EMPTY_PRACTICE,
    funnel: emptyFunnel(),
    revenue: emptyRevenue(),
    geo: { rows: [], total: 0, windowDays: 7, note: NO_GEO },
    stream: [],
    health: Array.from({ length: HEALTH_MINUTES }, (_, i) => ({
      t: Math.floor(t / MIN_MS) * MIN_MS - (HEALTH_MINUTES - 1 - i) * MIN_MS,
      events: 0,
    })),
    symbols: { rows: [], windowDays: 7, note: NO_SYMBOLS },
    bots: { rows: [], runs: 0, botsEngaged: 0, note: NO_BOT_IDS },
    errors: { rows: [], note: NO_ERROR_TELEMETRY },
    trades: { rows: [], note: NO_TRADES },
    kill: { rows: [], note: NO_KILL_HISTORY },
  };
}

/**
 * The three numbers the memo asked for, first and in order: signups in the
 * last 7 days, the share of signups that placed a paper trade within 24 hours,
 * and the share active in three separate weeks. Then the three that pay for
 * the lights. Deltas appear ONLY where a comparable previous window was
 * actually queried — an invented delta is the same lie in smaller type.
 */
export function buildKpis(m: Omit<AdminMetrics, "kpis">): KpiCell[] {
  const s = m.signups;
  const a = m.activation;
  const c = m.cohorts.threeWeekActive;
  const p = m.paper;
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const delta = (nowN: number, prev: number) => (prev > 0 ? ((nowN - prev) / prev) * 100 : undefined);
  const rateTone = (rate: number, eligible: number) =>
    eligible === 0 ? ("fg" as const) : rate >= 0.25 ? ("bull" as const) : rate >= 0.1 ? ("amber" as const) : ("bear" as const);

  return [
    {
      k: "signups · 7d",
      v: s.last7,
      tone: s.last7 > 0 ? "bull" : "fg",
      delta: delta(s.last7, s.prev7),
      spark: s.daily.map((d) => d.signups),
      sub: `${s.allTime} signup events all-time · ${s.usersTotal} rows in users`,
    },
    {
      k: "activation · 24h",
      v: pct(a.rate24h),
      unit: "%",
      decimals: 1,
      tone: rateTone(a.rate24h, a.eligible24h),
      sub: a.eligible24h
        ? `${a.within24h}/${a.eligible24h} signups traded within a day`
        : "no signup is 24h old yet",
    },
    {
      k: "3-week active",
      v: pct(c.share),
      unit: "%",
      decimals: 1,
      tone: rateTone(c.share, c.eligible),
      sub: c.eligible
        ? `${c.users}/${c.eligible} signups active in ≥3 weeks of their first month`
        : "no signup has had 28 days yet",
    },
    {
      k: "wau",
      v: m.audience.wau,
      tone: "fg",
      sub: `distinct users/devices · 7d · dau ${m.audience.dau} · mau ${m.audience.mau}`,
    },
    {
      k: "paper trades · 24h",
      v: p.trades24h,
      tone: p.trades24h > 0 ? "bull" : "fg",
      delta: delta(p.trades24h, p.prev24h),
      sub: `order_submitted + bet_placed · ${p.traders24h} traders`,
    },
    {
      k: "mrr",
      v: m.revenue.mrrUsd,
      unit: "USD",
      decimals: 2,
      tone: m.revenue.mrrUsd > 0 ? "bull" : "fg",
      sub: `${m.revenue.active} entitling subs · ₹${m.revenue.mrrInrNative} of it at ₹${m.revenue.inrPerUsd}/$`,
    },
  ];
}

/**
 * Everything the cockpit shows, in one round of parallel queries.
 *
 * Two failure modes, kept apart on purpose. If the database cannot be reached
 * at all, the page is OFFLINE: zeros and a red chip, because a partial answer
 * would be indistinguishable from a dead product. If the database is up but
 * one group's query fails, that group degrades to its zero value and names
 * itself in `degraded` — the rest of the page is still true.
 */
export async function getAdminMetrics(now: Date = new Date()): Promise<AdminMetrics> {
  try {
    await db();
  } catch (err) {
    return offlineMetrics(now, (err as Error)?.message ?? "mongo unreachable");
  }

  const degraded: string[] = [];
  const zeroSignups = { signups: emptySignups(now.getTime()), activation: EMPTY_ACTIVATION };
  const [
    sa, audience, cohorts, paper, teacher, practice, funnel, revenue, geo, stream, health, symbols, bots, errors, trades, kill,
  ] = await Promise.all([
    safe("signups", zeroSignups, () => signupsAndActivation(now), degraded),
    safe("audience", EMPTY_AUDIENCE, () => audienceMetrics(now), degraded),
    safe("cohorts", EMPTY_COHORTS, () => cohortMetrics(now), degraded),
    safe("paper", EMPTY_PAPER, () => paperMetrics(now), degraded),
    safe("teacher", EMPTY_TEACHER, () => teacherMetrics(now), degraded),
    safe("practice", EMPTY_PRACTICE, () => practiceMetrics(now), degraded),
    safe("funnel", emptyFunnel(), () => funnelMetrics(now), degraded),
    safe("revenue", emptyRevenue(), () => revenueMetrics(now), degraded),
    safe<GeoData>("geo", { rows: [], total: 0, windowDays: 7, note: NO_GEO }, () => geoMetrics(now), degraded),
    safe<EventRow[]>("stream", [], () => liveStream(now), degraded),
    safe<HealthPoint[]>("health", [], () => healthSeries(now), degraded),
    safe<SymbolData>("symbols", { rows: [], windowDays: 7, note: NO_SYMBOLS }, () => symbolMetrics(now), degraded),
    safe<BotRuns>("bots", { rows: [], runs: 0, botsEngaged: 0, note: NO_BOT_IDS }, () => botMetrics(now), degraded),
    safe<ErrorData>("errors", { rows: [], note: NO_ERROR_TELEMETRY }, () => errorMetrics(now), degraded),
    safe<TradeFeed>("trades", { rows: [], note: NO_TRADES }, () => tradeFeed(now), degraded),
    safe<KillHistory>("kill", { rows: [], note: NO_KILL_HISTORY }, () => killHistory(now), degraded),
  ]);

  const base: Omit<AdminMetrics, "kpis"> = {
    ok: true,
    degraded,
    error: null,
    generatedAt: now.getTime(),
    signups: sa.signups,
    activation: sa.activation,
    audience,
    cohorts,
    paper,
    teacher,
    practice,
    funnel,
    revenue,
    geo,
    stream,
    health: health.length
      ? health
      : Array.from({ length: HEALTH_MINUTES }, (_, i) => ({
          t: Math.floor(now.getTime() / MIN_MS) * MIN_MS - (HEALTH_MINUTES - 1 - i) * MIN_MS,
          events: 0,
        })),
    symbols,
    bots,
    errors,
    trades,
    kill,
  };
  return { ...base, kpis: buildKpis(base) };
}
