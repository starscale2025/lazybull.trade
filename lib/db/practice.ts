// The /practice store: every judged run, and every certificate minted from
// them. Two collections —
//
//   practice_submissions  one row per ▶ run or submit, signed in or not. The
//                         row carries the verdict the server computed, the
//                         wall time the solver's browser measured, a hash of
//                         the normalised code (so re-submitting the same
//                         program is visibly the same program) and, for
//                         signed-in users only, the code itself.
//   practice_certificates one row per (user, track), minted once the server
//                         has seen an accepted submit for every problem in
//                         the track. Public by id at /practice/certificate/<id>.
//
// Identity follows lib/db/events.ts: a userId when signed in, else the
// device id the browser sends (the same localStorage uuid lib/track.ts
// writes). Reads take BOTH, so a solver who signs in after a week of
// anonymous solving keeps the week. Every field is bounded by zod so a
// hostile client cannot bloat the collection; the aggregations are the
// ONLY source of the acceptance rates, the leaderboard and the runtime
// percentile the UI prints — there is no seeded number anywhere.

import { createHash } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";
import { normalise } from "../practice/judge";
import { MAX_CODE_CHARS } from "../practice/types";
import type {
  CertificateRecord,
  Lang,
  LeaderboardRow,
  ProgressState,
  RunMode,
  SlugStats,
  Submission,
  TrackId,
  Verdict,
} from "../practice/types";

/* ── wire shapes ─────────────────────────────────────────────────────────── */

export { MAX_CODE_CHARS };
/** The whole submit body: 20k of code plus 16 short outputs, with room. */
export const MAX_SUBMIT_BODY_BYTES = 80_000;
/** An acceptance rate is shown once a problem has this many submits. */
export const MIN_SUBMISSIONS_FOR_RATE = 5;
/** A runtime percentile is shown once a problem has this many accepted submits. */
export const MIN_ACCEPTED_FOR_PERCENTILE = 5;
export const RECENT_SUBMISSIONS = 50;

const Device = z.string().min(4).max(64);
const TRACKS = ["finance", "quant", "ml", "maths", "trading"] as const;

export const CaseOutputInput = z.object({
  id: z.string().min(1).max(8),
  got: z.string().max(4_000),
  ms: z.number().finite().min(0).max(600_000),
  error: z.string().max(500).optional(),
});

export const SubmitBody = z.object({
  lang: z.literal("python"),
  mode: z.enum(["run", "submit"]),
  code: z.string().max(MAX_CODE_CHARS),
  outputs: z.array(CaseOutputInput).max(16),
  /** The worker's top-level failure (syntax error, missing entry): nothing was judged. */
  error: z.object({ title: z.string().max(80), detail: z.string().max(500) }).optional(),
  device: Device.optional(),
});

export const CertificateBody = z.object({
  track: z.enum(TRACKS),
  device: Device.optional(),
});

export const DeviceHeader = Device;

/* ── documents ───────────────────────────────────────────────────────────── */

type SubmissionDoc = {
  _id?: ObjectId;
  userId?: ObjectId;
  device?: string;
  slug: string;
  lang: Lang;
  mode: RunMode;
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number;
  codeHash: string;
  code?: string;
  createdAt: Date;
};

type CertificateDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  track: TrackId;
  mintedAt: Date;
  displayName: string;
};

let subsIndexReady: Promise<unknown> | null = null;
async function subs() {
  const c = (await db()).collection<SubmissionDoc>("practice_submissions");
  subsIndexReady ??= Promise.all([
    c.createIndex({ slug: 1, createdAt: -1 }),
    c.createIndex({ userId: 1, createdAt: -1 }),
    c.createIndex({ device: 1, createdAt: -1 }),
  ]).catch(() => {});
  await subsIndexReady;
  return c;
}

let certsIndexReady: Promise<unknown> | null = null;
async function certs() {
  const c = (await db()).collection<CertificateDoc>("practice_certificates");
  // Awaited: mintCertificate leans on the unique index to make a race between
  // two mints of the same track a duplicate-key error, not a second row.
  certsIndexReady ??= c.createIndex({ userId: 1, track: 1 }, { unique: true }).catch(() => {});
  await certsIndexReady;
  return c;
}

/* ── identity ────────────────────────────────────────────────────────────── */

export type Identity = { userId?: string | null; device?: string | null };

function identityFilter(id: Identity): Filter<SubmissionDoc> | null {
  const ors: Filter<SubmissionDoc>[] = [];
  if (id.userId && ObjectId.isValid(id.userId)) ors.push({ userId: new ObjectId(id.userId) });
  if (id.device) ors.push({ device: id.device });
  if (ors.length === 0) return null;
  return ors.length === 1 ? ors[0] : { $or: ors };
}

/** sha256 of the normalised code — whitespace-only edits hash the same. */
export function codeHash(code: string): string {
  return createHash("sha256").update(normalise(code)).digest("hex");
}

/** "Shaurya Negi" → "Shaurya N." — what a public row shows of a signed-in
    solver. A single word stays as it is; nothing falls back to an email. */
export function publicName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "anonymous";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/* ── submissions ─────────────────────────────────────────────────────────── */

export type RecordInput = {
  identity: Identity;
  slug: string;
  lang: Lang;
  mode: RunMode;
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number;
  code: string;
};

export async function recordSubmission(input: RecordInput): Promise<{ id: string; createdAt: Date }> {
  const c = await subs();
  const now = new Date();
  const userId = input.identity.userId && ObjectId.isValid(input.identity.userId) ? new ObjectId(input.identity.userId) : null;
  const doc: SubmissionDoc = {
    ...(userId ? { userId } : {}),
    ...(input.identity.device ? { device: input.identity.device } : {}),
    slug: input.slug,
    lang: input.lang,
    mode: input.mode,
    verdict: input.verdict,
    passed: input.passed,
    total: input.total,
    runtimeMs: input.runtimeMs,
    codeHash: codeHash(input.code),
    // The program itself is kept for signed-in users only — it is theirs to
    // come back to. Anonymous rows keep the hash, which is enough to count.
    ...(userId ? { code: input.code.slice(0, MAX_CODE_CHARS) } : {}),
    createdAt: now,
  };
  const r = await c.insertOne(doc);
  return { id: r.insertedId.toHexString(), createdAt: now };
}

/** Per-slug submit counts and accepted counts. Slugs with no rows are absent. */
export async function statsFor(slugs: string[]): Promise<Record<string, SlugStats>> {
  if (slugs.length === 0) return {};
  const c = await subs();
  const rows = await c
    .aggregate<{ _id: string; submissions: number; accepted: number }>([
      { $match: { slug: { $in: slugs }, mode: "submit" } },
      {
        $group: {
          _id: "$slug",
          submissions: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$verdict", "accepted"] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const out: Record<string, SlugStats> = {};
  for (const r of rows) out[r._id] = { submissions: r.submissions, accepted: r.accepted };
  return out;
}

/** The share (0–100) of accepted submits for `slug` slower than `runtimeMs`,
    or null until MIN_ACCEPTED_FOR_PERCENTILE accepted submits exist. Runtimes
    are measured in each solver's own browser, so this is a rough ladder, and
    the UI says so. */
export async function runtimePercentile(slug: string, runtimeMs: number): Promise<number | null> {
  const c = await subs();
  const base: Filter<SubmissionDoc> = { slug, mode: "submit", verdict: "accepted" };
  const total = await c.countDocuments(base);
  if (total < MIN_ACCEPTED_FOR_PERCENTILE) return null;
  const slower = await c.countDocuments({ ...base, runtimeMs: { $gt: runtimeMs } });
  return Math.round((100 * slower) / total);
}

function toSubmission(d: SubmissionDoc): Submission {
  return {
    id: d._id ? d._id.toHexString() : "",
    slug: d.slug,
    lang: d.lang,
    mode: d.mode,
    verdict: d.verdict,
    passed: d.passed,
    total: d.total,
    runtimeMs: d.runtimeMs,
    at: d.createdAt.getTime(),
  };
}

/** Everything the profile needs, from the rows: first accepted submit per
    slug, attempt counts, and the last RECENT_SUBMISSIONS rows. */
export async function progressFor(identity: Identity): Promise<ProgressState> {
  const filter = identityFilter(identity);
  const empty: ProgressState = { solved: {}, attempts: {}, submissions: [] };
  if (!filter) return empty;
  const c = await subs();
  const [solvedRows, attemptRows, recent] = await Promise.all([
    c
      .aggregate<{ _id: string; at: Date; lang: Lang; runtimeMs: number }>([
        { $match: { ...filter, mode: "submit", verdict: "accepted" } },
        // _id breaks the tie: two submits can share a millisecond (a user
        // hitting submit twice, or a test writing in a loop), and without a
        // second key the sort is unstable — "your first solve" would then be
        // whichever row the engine happened to return. ObjectIds rise
        // monotonically within a process, so this is the earlier row.
        { $sort: { createdAt: 1, _id: 1 } },
        { $group: { _id: "$slug", at: { $first: "$createdAt" }, lang: { $first: "$lang" }, runtimeMs: { $first: "$runtimeMs" } } },
      ])
      .toArray(),
    c.aggregate<{ _id: string; n: number }>([{ $match: filter }, { $group: { _id: "$slug", n: { $sum: 1 } } }]).toArray(),
    c.find(filter).sort({ createdAt: -1, _id: -1 }).limit(RECENT_SUBMISSIONS).toArray(),
  ]);
  const solved: ProgressState["solved"] = {};
  for (const r of solvedRows) solved[r._id] = { at: r.at.getTime(), lang: r.lang, runtimeMs: r.runtimeMs };
  const attempts: ProgressState["attempts"] = {};
  for (const r of attemptRows) attempts[r._id] = r.n;
  return { solved, attempts, submissions: recent.map(toSubmission) };
}

/** The slugs among `slugs` this identity has an accepted submit for. */
export async function acceptedSlugsFor(identity: Identity, slugs: string[]): Promise<Set<string>> {
  const filter = identityFilter(identity);
  if (!filter || slugs.length === 0) return new Set();
  const c = await subs();
  const found = await c.distinct("slug", { ...filter, mode: "submit", verdict: "accepted", slug: { $in: slugs } });
  return new Set(found);
}

/* ── the weekly set ──────────────────────────────────────────────────────── */

/**
 * The board for one edition: everyone with an accepted submit on the set's
 * problems inside [start, end), ranked on distinct problems solved, then on
 * the time from `start` to their last accepted submit. Signed-in rows show
 * publicName(); device-only rows are "anonymous". Never money — the row
 * type has no such column.
 */
export async function contestBoard(problems: string[], start: Date, end: Date, limit = 50): Promise<LeaderboardRow[]> {
  if (problems.length === 0) return [];
  const c = await subs();
  const rows = await c
    .aggregate<{ _id: ObjectId | string; slugs: string[]; last: Date }>([
      { $match: { slug: { $in: problems }, mode: "submit", verdict: "accepted", createdAt: { $gte: start, $lt: end } } },
      // One row per person: the user id when signed in, else the device.
      { $group: { _id: { $ifNull: ["$userId", { $concat: ["d:", { $ifNull: ["$device", "?"] }] }] }, slugs: { $addToSet: "$slug" }, last: { $max: "$createdAt" } } },
      { $project: { slugs: 1, last: 1, solved: { $size: "$slugs" } } },
      { $sort: { solved: -1, last: 1 } },
      { $limit: limit },
    ])
    .toArray();

  const userIds = rows.map((r) => r._id).filter((id): id is ObjectId => id instanceof ObjectId);
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await (await db())
      .collection<{ _id: ObjectId; name?: string | null }>("users")
      .find({ _id: { $in: userIds } }, { projection: { name: 1 } })
      .toArray();
    for (const u of users) names.set(u._id.toHexString(), publicName(u.name));
  }

  return rows.map((r, i) => ({
    rank: i + 1,
    name: r._id instanceof ObjectId ? (names.get(r._id.toHexString()) ?? "anonymous") : "anonymous",
    solved: r.slugs.length,
    total: problems.length,
    timeMs: Math.max(0, r.last.getTime() - start.getTime()),
  }));
}

/** Distinct solvers (≥1 accepted submit on the set) per window. */
export async function solversPerWindow(problems: string[], windows: { start: Date; end: Date }[]): Promise<number[]> {
  if (problems.length === 0 || windows.length === 0) return windows.map(() => 0);
  const c = await subs();
  return Promise.all(
    windows.map(async (w) => {
      const rows = await c
        .aggregate<{ _id: unknown }>([
          { $match: { slug: { $in: problems }, mode: "submit", verdict: "accepted", createdAt: { $gte: w.start, $lt: w.end } } },
          { $group: { _id: { $ifNull: ["$userId", { $concat: ["d:", { $ifNull: ["$device", "?"] }] }] } } },
          { $count: "n" },
        ])
        .toArray();
      return (rows[0] as { n?: number } | undefined)?.n ?? 0;
    })
  );
}

/* ── certificates ────────────────────────────────────────────────────────── */

function toCertificate(d: CertificateDoc): CertificateRecord {
  return { id: d._id ? d._id.toHexString() : "", track: d.track, displayName: d.displayName, mintedAt: d.mintedAt.toISOString() };
}

/** Idempotent per (user, track): the second call returns the first row. The
    caller has already verified the track is complete. */
export async function mintCertificate(
  userId: string,
  track: TrackId,
  displayName: string
): Promise<{ certificate: CertificateRecord; created: boolean }> {
  const c = await certs();
  const oid = new ObjectId(userId);
  const existing = await c.findOne({ userId: oid, track });
  if (existing) return { certificate: toCertificate(existing), created: false };
  const doc: CertificateDoc = { userId: oid, track, mintedAt: new Date(), displayName: displayName.slice(0, 120) };
  try {
    const r = await c.insertOne(doc);
    return { certificate: toCertificate({ ...doc, _id: r.insertedId }), created: true };
  } catch {
    // Duplicate key: a concurrent mint won the race — hand back its row.
    const won = await c.findOne({ userId: oid, track });
    if (!won) throw new Error("certificate could not be minted");
    return { certificate: toCertificate(won), created: false };
  }
}

export async function certificatesFor(userId: string): Promise<CertificateRecord[]> {
  if (!ObjectId.isValid(userId)) return [];
  const c = await certs();
  const rows = await c.find({ userId: new ObjectId(userId) }).sort({ mintedAt: 1 }).toArray();
  return rows.map(toCertificate);
}

export async function getCertificate(id: string): Promise<CertificateRecord | null> {
  if (!ObjectId.isValid(id)) return null;
  const c = await certs();
  const row = await c.findOne({ _id: new ObjectId(id) });
  return row ? toCertificate(row) : null;
}
