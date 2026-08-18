// /api/events — the product-events sink. POST-only, batched, auth-optional:
// signed-in events carry the userId, anonymous ones carry the device id so
// pre-signup activity can be linked after conversion.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EventsBody, insertEvents, MAX_EVENTS_BODY_BYTES } from "@/lib/db/events";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Light per-IP limiter, in-memory. Serverless instances each get their own
// map; that's fine for a nuisance cap.
const WINDOW_MS = 60_000;
const MAX_BATCHES_PER_WINDOW = 30;
const hits = new Map<string, { n: number; at: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > WINDOW_MS) {
    hits.set(ip, { n: 1, at: now });
    return false;
  }
  h.n++;
  return h.n > MAX_BATCHES_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  }
  try {
    const raw = await req.text();
    if (raw.length > MAX_EVENTS_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "batch too large" }, { status: 413 });
    }
    const { device, events } = EventsBody.parse(JSON.parse(raw));
    const session = await auth().catch(() => null);
    const inserted = await insertEvents(session?.user?.id ?? null, device, events);
    return NextResponse.json({ ok: true, inserted });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
