// The events collection — the raw material for every future question about
// how people actually use the product. One append-only stream, indexed by
// user and by type; individual event shapes stay loose on purpose (analytics
// schemas churn), but every FIELD is bounded so a hostile client can't bloat
// the collection.

import { ObjectId } from "mongodb";
import { z } from "zod";
import { db } from "../mongo";

const PropValue = z.union([z.string().max(400), z.number(), z.boolean(), z.null()]);

export const EventInput = z.object({
  /** snake_case event name, e.g. "page_view", "order_submitted". */
  type: z.string().min(1).max(48).regex(/^[a-z0-9_]+$/),
  /** Client clock at emit time (informational — the server stamps its own). */
  ts: z.number().int().positive().optional(),
  /** Pathname the event fired on. */
  page: z.string().max(200).optional(),
  props: z.record(z.string().max(48), PropValue).optional(),
});

export const EventsBody = z.object({
  /** Anonymous device id (localStorage uuid) — links pre-signup activity. */
  device: z.string().min(4).max(64).optional(),
  events: z.array(EventInput).min(1).max(50),
});

export const MAX_EVENTS_BODY_BYTES = 32_000;

type EventDoc = {
  userId?: ObjectId;
  device?: string;
  type: string;
  page?: string;
  props?: Record<string, unknown>;
  /** Client clock (ms) — may drift; the server time is the truth. */
  clientTs?: number;
  createdAt: Date;
};

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<EventDoc>("events");
  indexReady ??= Promise.all([
    c.createIndex({ userId: 1, createdAt: -1 }),
    c.createIndex({ type: 1, createdAt: -1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

export async function insertEvents(
  userId: string | null,
  device: string | undefined,
  events: z.infer<typeof EventInput>[]
): Promise<number> {
  const c = await coll();
  const now = new Date();
  const docs: EventDoc[] = events.map((e) => ({
    ...(userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}),
    ...(device ? { device } : {}),
    type: e.type,
    ...(e.page ? { page: e.page } : {}),
    ...(e.props ? { props: e.props } : {}),
    ...(e.ts ? { clientTs: e.ts } : {}),
    createdAt: now,
  }));
  const r = await c.insertMany(docs);
  return r.insertedCount;
}

/** Server-originated events (sign-in, webhooks…) — same stream, no HTTP hop.
    Never throws: analytics must not break the flow that emitted it. */
export async function logServerEvent(
  type: string,
  userId?: string | null,
  props?: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    const c = await coll();
    await c.insertOne({
      ...(userId && ObjectId.isValid(userId) ? { userId: new ObjectId(userId) } : {}),
      type,
      ...(props ? { props } : {}),
      createdAt: new Date(),
    });
  } catch {
    /* swallowed by design */
  }
}
