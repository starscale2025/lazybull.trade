// /api/consent — the audit trail for the consent + age gate.
//
//   POST { v:1, adult:true, analytics, training, at, device? }
//        → upserts lib/db/consent.ts (keyed by user when signed in, else by
//          device) and logs a `consent_given` product event server-side, so
//          the decision is in the same stream as the events it governs.
//   GET  → the signed-in user's current record (401 anonymous: a device-keyed
//          record is not returned to whoever holds the id).
//
// The gate NEVER depends on this route: local consent applies whether the
// write lands or not (no MONGODB_URI locally → 503 here, app keeps working).
// Minors are never posted (lib/consent.ts header) and the schema refuses
// `adult: false` so a mis-wired client cannot start a child record.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ConsentInput, MAX_CONSENT_BODY_BYTES } from "@/lib/consent";
import { getConsent, upsertConsent } from "@/lib/db/consent";
import { logServerEvent } from "@/lib/db/events";
import { clientIp, underLimit } from "@/lib/rate-limit";
import { regionFromHeaders } from "@/lib/region";

export const dynamic = "force-dynamic";

// Per-minute caps (per-IP, global). A person decides once, maybe changes their
// mind a few times; anything past that is a script.
const MAX_PER_IP = 10;
const MAX_GLOBAL = 600;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!(await underLimit("consent", ip, MAX_PER_IP, MAX_GLOBAL))) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  }
  let input: ConsentInput;
  try {
    const raw = await req.text();
    if (raw.length > MAX_CONSENT_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });
    }
    input = ConsentInput.parse(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const country = regionFromHeaders(req.headers);
  const ua = req.headers.get("user-agent");

  try {
    const consent = await upsertConsent(input, { userId, country, ua });
    // Same stream as the events this consent governs. Flags only — no PII.
    await logServerEvent(
      "consent_given",
      userId,
      { analytics: input.analytics, training: input.training, version: input.v, text: consent.text },
      { country, device: input.device ?? null }
    );
    return NextResponse.json({ ok: true, stored: true, linked: !!userId });
  } catch (err) {
    // The DB is the record, not the switch: tell the client it was not stored
    // and let local consent stand. Never a 500 that a client might retry-loop.
    return NextResponse.json({ ok: false, stored: false, error: (err as Error).message }, { status: 503 });
  }
}

export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  try {
    const consent = await getConsent(userId);
    return NextResponse.json({ ok: true, consent }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
