// The events collection — the raw material for every future question about
// how people actually use the product. One append-only stream, indexed by
// user and by type; individual event shapes stay loose on purpose (analytics
// schemas churn), but every FIELD is bounded so a hostile client can't bloat
// the collection.
//
// SCHEMA v2 (the diligence memo: "events lack schema_version, country and
// referrer/UTM, so channels cannot be attributed"). Two things changed:
//   • the client stamps `sv` (schema version) on every event, and the first
//     page_view of a session carries `ref` + `utm_*`, with the first-touch
//     attribution repeated on later events as `ft_*` (see lib/track.ts);
//   • the SERVER adds `country` (ISO-2 from the platform geo header, never an
//     IP) so a cohort can be split India / US / UK without touching PII.
// v1 events (no `sv`) are still accepted and stored as-is: an old tab open
// across the deploy must not have its batch rejected.
//
// CONSENT. This module does not check consent — it cannot, it only sees a
// batch. The gate is upstream in lib/track.ts (nothing is QUEUED without an
// adult yes) and the audit trail is lib/db/consent.ts. A batch arriving here
// is, by construction, a consented one.

import { ObjectId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";

const PropValue = z.union([z.string().max(400), z.number(), z.boolean(), z.null()]);

/** Current client schema version — lib/track.ts stamps it on every event. */
export const EVENT_SCHEMA_VERSION = 2;

export const EventInput = z.object({
  /** snake_case event name, e.g. "page_view", "order_submitted". */
  type: z.string().min(1).max(48).regex(/^[a-z0-9_]+$/),
  /** Client clock at emit time (informational — the server stamps its own). */
  ts: z.number().int().positive().optional(),
  /** Pathname the event fired on. */
  page: z.string().max(200).optional(),
  /** Client schema version (v2+). Absent on v1 events from older tabs. */
  sv: z.number().int().min(1).max(99).optional(),
  props: z.record(z.string().max(48), PropValue).optional(),
});

export const EventsBody = z.object({
  /** Anonymous device id (localStorage uuid) — links pre-signup activity. */
  device: z.string().min(4).max(64).optional(),
  events: z.array(EventInput).min(1).max(50),
});

export const MAX_EVENTS_BODY_BYTES = 32_000;

/** Server-side facts attached to a stored event (never client-supplied). */
export type EventContext = {
  /** ISO-2 from the platform geo header (lib/region.ts) — ≤ 2 chars, never an IP. */
  country?: string | null;
  /** Anonymous device id, for server events that know it (consent_given). */
  device?: string | null;
};

type EventDoc = {
  userId?: ObjectId;
  device?: string;
  type: string;
  page?: string;
  props?: Record<string, unknown>;
  /** Client schema version (see EVENT_SCHEMA_VERSION). */
  sv?: number;
  /** ISO-2 viewer country at ingest time. */
  country?: string;
  /** Client clock (ms) — may drift; the server time is the truth. */
  clientTs?: number;
  createdAt: Date;
};

const ISO2 = /^[A-Z]{2}$/;
const countryField = (c?: string | null) => (c && ISO2.test(c) ? { country: c } : {});

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<EventDoc>("events");
  indexReady ??= Promise.all([
    c.createIndex({ userId: 1, createdAt: -1 }),
    c.createIndex({ type: 1, createdAt: -1 }),
    // The admin metrics (lib/admin-metrics.ts) sort and window the whole
    // stream by time with no type or user prefix — the live tail, the
    // audience counts, the funnel and the events-per-minute chart all do it.
    // Without this they are collection scans; fine at today's volume, not at
    // a million rows.
    c.createIndex({ createdAt: -1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

export async function insertEvents(
  userId: string | null,
  device: string | undefined,
  events: z.infer<typeof EventInput>[],
  ctx: EventContext = {}
): Promise<number> {
  const c = await coll();
  const now = new Date();
  const docs: EventDoc[] = events.map((e) => ({
    ...(userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}),
    ...(device ? { device } : {}),
    type: e.type,
    ...(e.page ? { page: e.page } : {}),
    ...(e.props ? { props: e.props } : {}),
    ...(e.sv ? { sv: e.sv } : {}),
    ...countryField(ctx.country),
    ...(e.ts ? { clientTs: e.ts } : {}),
    createdAt: now,
  }));
  const r = await c.insertMany(docs);
  return r.insertedCount;
}

/** Server-originated events (sign-in, webhooks, consent…) — same stream, no
    HTTP hop. Never throws: analytics must not break the flow that emitted it. */
export async function logServerEvent(
  type: string,
  userId?: string | null,
  props?: Record<string, string | number | boolean | null>,
  ctx: EventContext = {}
): Promise<void> {
  try {
    const c = await coll();
    await c.insertOne({
      ...(userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}),
      ...(ctx.device ? { device: ctx.device.slice(0, 64) } : {}),
      type,
      ...(props ? { props } : {}),
      sv: EVENT_SCHEMA_VERSION,
      ...countryField(ctx.country),
      createdAt: new Date(),
    });
  } catch {
    /* swallowed by design */
  }
}
