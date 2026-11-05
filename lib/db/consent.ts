// The consents collection — the audit trail behind every product event.
//
// The diligence memo's condition for the decision-trace dataset being worth
// anything: "Decision-trace logging with consent: schema version,
// DPDP-compliant consent text, age gate … an un-consented dataset is an
// un-sellable dataset." This collection is the proof. One document per
// device (anonymous) or per user (signed in), upserted on every change, so
// the CURRENT choice is one read and the history is in the events stream
// (`consent_given`, logged beside the upsert by the route).
//
// What it holds, and why each field is here:
//   version / text   the schema and the exact wording agreed to
//   adult            always true here — minors are never posted (lib/consent.ts)
//   analytics        product analytics yes/no
//   training         anonymised decision traces for the AI teacher yes/no
//   country          ISO-2 from the platform geo header — the DPDP question is
//                    "is this an Indian data principal", and this answers it
//                    without storing an IP
//   ua               user agent, clamped to 200 chars — enough to reproduce a
//                    consent-UI bug, not enough to fingerprint
//   consentAt        the client's timestamp of the click; createdAt/updatedAt
//                    are the server's
//
// Never required: the gate applies local consent whether or not this write
// lands (no MONGODB_URI locally). It is the record, not the switch.

import { ObjectId } from "mongodb";
import { db } from "../mongo";
import { CONSENT_TEXT_VERSION, type ConsentInput } from "../consent";

export type ConsentDoc = {
  userId?: ObjectId;
  device?: string;
  version: 1;
  /** Which consent wording was agreed to (lib/consent.ts CONSENT_TEXT_VERSION). */
  text: string;
  adult: true;
  analytics: boolean;
  training: boolean;
  country?: string;
  ua?: string;
  consentAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ConsentContext = {
  userId?: string | null;
  country?: string | null;
  ua?: string | null;
};

const ISO2 = /^[A-Z]{2}$/;
export const MAX_UA_CHARS = 200;

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<ConsentDoc>("consents");
  indexReady ??= Promise.all([
    // One record per user; partial so anonymous (device-only) docs don't collide on a null key.
    c.createIndex({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } }),
    c.createIndex({ device: 1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

/** The public shape (no _id, no ObjectId) handed back by GET /api/consent. */
export type ConsentView = Omit<ConsentDoc, "userId"> & { userId?: string };

const toView = (d: ConsentDoc & { _id?: ObjectId }): ConsentView => {
  const { _id: _ignored, userId, ...rest } = d;
  void _ignored;
  return { ...rest, ...(userId ? { userId: userId.toHexString() } : {}) };
};

/**
 * Record (or update) a consent decision. Keyed by userId when signed in,
 * otherwise by the anonymous device id; a signed-in user's record absorbs a
 * later device-only re-post because the userId filter wins. Returns the
 * stored view. Throws on DB failure — the ROUTE swallows, the caller's local
 * consent still applies.
 */
export async function upsertConsent(input: ConsentInput, ctx: ConsentContext = {}): Promise<ConsentView> {
  const c = await coll();
  const now = new Date();
  const userId = ctx.userId && ObjectId.isValid(ctx.userId) ? new ObjectId(ctx.userId) : null;
  if (!userId && !input.device) throw new Error("consent: no subject (neither user nor device)");

  const filter = userId ? { userId } : { device: input.device, userId: { $exists: false } };
  const consentAt = new Date(input.at);
  const set: Partial<ConsentDoc> = {
    ...(userId ? { userId } : {}),
    ...(input.device ? { device: input.device } : {}),
    version: 1,
    text: input.text ?? CONSENT_TEXT_VERSION,
    adult: true,
    analytics: input.analytics,
    training: input.training,
    ...(ctx.country && ISO2.test(ctx.country) ? { country: ctx.country } : {}),
    ...(ctx.ua ? { ua: ctx.ua.slice(0, MAX_UA_CHARS) } : {}),
    consentAt: Number.isFinite(consentAt.getTime()) ? consentAt : now,
    updatedAt: now,
  };
  const r = await c.findOneAndUpdate(
    filter,
    { $set: set, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  if (!r) throw new Error("consent: upsert returned no document");
  return toView(r);
}

/** The signed-in user's current record, or null. */
export async function getConsent(userId: string): Promise<ConsentView | null> {
  if (!ObjectId.isValid(userId)) return null;
  const c = await coll();
  const d = await c.findOne({ userId: new ObjectId(userId) });
  return d ? toView(d) : null;
}
