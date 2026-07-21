// Server-side store for paper-account snapshots. One doc per user, guarded by
// an optimistic-concurrency `rev` so two devices can't silently clobber each
// other: a PUT names the rev it built on, and a mismatch comes back as a
// conflict carrying the current server copy.

import { ObjectId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";
import { sanitizeShares } from "../paper-shares";

const Num = z.number().finite();

// Loose on purpose (same philosophy as workspaces): top-level shape + bounds
// only, the rest opaque — the client engine owns the semantics. Bounds mirror
// the client-side caps so a hostile client can't bloat the collection.
export const PaperSnapshotSchema = z
  .object({
    cash: Num,
    startingCash: Num,
    realizedToday: Num,
    positions: z.array(z.unknown()).max(300),
    shares: z.record(z.string().max(20), z.unknown()),
    orders: z.array(z.unknown()).max(500),
    trades: z.array(z.unknown()).max(200),
    balanceLog: z.array(z.unknown()).max(200),
    journal: z.record(z.string().max(80), z.string().max(2000)),
  })
  .passthrough();

export const PaperPutBody = z.object({
  baseRev: z.number().int().min(0),
  state: PaperSnapshotSchema,
});

/** Hard ceiling on the serialized snapshot — well above any capped account. */
export const MAX_SNAPSHOT_BYTES = 512_000;

type PaperDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  state: z.infer<typeof PaperSnapshotSchema>;
  rev: number;
  createdAt: Date;
  updatedAt: Date;
};

let indexEnsured = false;
async function coll() {
  const c = (await db()).collection<PaperDoc>("paper_accounts");
  if (!indexEnsured) {
    indexEnsured = true;
    // Lazy, once per process; failure is non-fatal (the query path still works).
    c.createIndex({ userId: 1 }, { unique: true }).catch(() => {});
  }
  return c;
}

export async function getPaper(userId: string) {
  const c = await coll();
  const doc = await c.findOne({ userId: new ObjectId(userId) });
  if (!doc) return { rev: 0 as const, updatedAt: null, state: null };
  return { rev: doc.rev, updatedAt: doc.updatedAt, state: doc.state };
}

export type PutResult =
  | { ok: true; rev: number }
  | { ok: false; conflict: { rev: number; updatedAt: Date | null; state: unknown } };

export async function putPaper(
  userId: string,
  baseRev: number,
  state: z.infer<typeof PaperSnapshotSchema>
): Promise<PutResult> {
  const c = await coll();
  const oid = new ObjectId(userId);
  const now = new Date();
  // The wire is attacker-adjacent exactly like localStorage — re-run the same
  // sanitizer the client hydration uses before anything is stored.
  const clean = { ...state, shares: sanitizeShares(state.shares) };
  try {
    const r = await c.findOneAndUpdate(
      { userId: oid, rev: baseRev },
      { $set: { state: clean, updatedAt: now }, $inc: { rev: 1 }, $setOnInsert: { createdAt: now } },
      { upsert: baseRev === 0, returnDocument: "after" }
    );
    if (r) return { ok: true, rev: r.rev };
  } catch {
    // Duplicate-key: baseRev 0 raced an existing doc → fall through to conflict.
  }
  const cur = await c.findOne({ userId: oid });
  return {
    ok: false,
    conflict: cur
      ? { rev: cur.rev, updatedAt: cur.updatedAt, state: cur.state }
      : { rev: 0, updatedAt: null, state: null },
  };
}
