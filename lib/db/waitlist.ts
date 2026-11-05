// The waitlist — a real list this time.
//
// The 2026-09 diligence memo: "Waitlist: None. 'Join early access' and 'Join
// the waitlist' both route to sign-in; there is no list." This is the list.
// One row per (email, tier); the unique index makes a repeat click a
// no-op the route reports as `already:true` rather than an error, and the
// tier + currency on each row are what turn "join the list" into a demand
// signal per tier per market (India ₹ vs global $ — the memo's "test it
// instead of assuming zero").
//
// Bounded like lib/db/events.ts: every field validated and capped before it
// reaches Mongo. Emails are stored lowercased and trimmed, nothing else is
// kept about the person.

import { ObjectId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";

export const WAITLIST_TIERS = ["plus", "pro", "power"] as const;
export type WaitlistTier = (typeof WAITLIST_TIERS)[number];

export const WaitlistInput = z.object({
  tier: z.enum(WAITLIST_TIERS),
  currency: z.enum(["USD", "INR"]),
  /** Optional when signed in (the session email is used); required otherwise. */
  email: z.string().max(254).optional(),
});

/** Largest body /api/waitlist accepts (chars). */
export const MAX_WAITLIST_BODY_BYTES = 2_000;

// Deliberately loose — this is a mailing-list address, not an identity. The
// shape check stops garbage; a provider bounce is the real validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lowercased, trimmed, shape-checked, ≤ 254 chars (RFC 5321) — or null. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

export type WaitlistDoc = {
  _id?: ObjectId;
  email: string;
  tier: WaitlistTier;
  currency: "USD" | "INR";
  userId?: ObjectId;
  /** ISO 3166-1 alpha-2 from the edge, when the platform provides it. */
  region?: string;
  createdAt: Date;
};

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<WaitlistDoc>("waitlist");
  // Awaited: the dedupe below RELIES on the unique index turning a repeat
  // into E11000 (the watchlists precedent) — without it a double-click would
  // insert two rows.
  indexReady ??= Promise.all([
    c.createIndex({ email: 1, tier: 1 }, { unique: true }),
    c.createIndex({ tier: 1, createdAt: -1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

export async function joinWaitlist(input: {
  email: string;
  tier: WaitlistTier;
  currency: "USD" | "INR";
  userId?: string | null;
  region?: string | null;
}): Promise<{ already: boolean }> {
  const c = await coll();
  const doc: WaitlistDoc = {
    email: input.email,
    tier: input.tier,
    currency: input.currency,
    ...(input.userId && ObjectId.isValid(input.userId) ? { userId: new ObjectId(input.userId) } : {}),
    ...(input.region ? { region: input.region.slice(0, 2).toUpperCase() } : {}),
    createdAt: new Date(),
  };
  try {
    await c.insertOne(doc);
    return { already: false };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { already: true };
    throw e;
  }
}

/** Rows per tier — the public number the pricing page shows once it is ≥ 10. */
export async function waitlistCounts(): Promise<Record<WaitlistTier, number>> {
  const c = await coll();
  const out: Record<WaitlistTier, number> = { plus: 0, pro: 0, power: 0 };
  const rows = await c
    .aggregate<{ _id: WaitlistTier; n: number }>([{ $group: { _id: "$tier", n: { $sum: 1 } } }])
    .toArray();
  for (const r of rows) if (r._id in out) out[r._id] = r.n;
  return out;
}

/** The tiers one address is waiting on — for the account page. */
export async function waitlistFor(email: string): Promise<Pick<WaitlistDoc, "tier" | "currency" | "createdAt">[]> {
  const e = normalizeEmail(email);
  if (!e) return [];
  const c = await coll();
  return c
    .find({ email: e }, { projection: { _id: 0, tier: 1, currency: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .limit(10)
    .toArray();
}

/** Test-only: forget the index memo so a fresh memory Mongo re-creates it. */
export function __resetWaitlist(): void {
  indexReady = null;
}
