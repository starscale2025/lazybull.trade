// POST /api/waitlist — { tier, currency, email? } → { ok, already }.
//
// The list the pricing page's "join the list" actually writes to (the 2026-09
// diligence memo found none). Works signed in (session email, no typing) and
// signed out (email required). One row per (email, tier); a repeat is a 200
// with `already:true`, never an error the form has to explain. Rate-limited
// per IP because it is an unauthenticated write.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { countryFrom, readBoundedBody } from "@/lib/billing/request";
import { BILLING_EVENTS } from "@/lib/billing/types";
import { logServerEvent } from "@/lib/db/events";
import { MAX_WAITLIST_BODY_BYTES, WaitlistInput, joinWaitlist, normalizeEmail } from "@/lib/db/waitlist";
import { clientIp, consume } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PER_IP = 5;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!(await consume(`waitlist:ip:${ip}`, MAX_PER_IP))) {
    return NextResponse.json({ ok: false, error: "too many requests — try again in a minute" }, { status: 429 });
  }
  const body = await readBoundedBody(req, MAX_WAITLIST_BODY_BYTES);
  if (body === null) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const parsed = WaitlistInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const email = normalizeEmail(parsed.data.email || session?.user?.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: parsed.data.email ? "invalid email" : "email required" },
      { status: 400 },
    );
  }

  try {
    const { already } = await joinWaitlist({
      email,
      tier: parsed.data.tier,
      currency: parsed.data.currency,
      userId: session?.user?.id ?? null,
      region: countryFrom(req.headers),
    });
    if (!already) {
      await logServerEvent(BILLING_EVENTS.waitlistJoined, session?.user?.id ?? null, {
        tier: parsed.data.tier,
        currency: parsed.data.currency,
      });
    }
    return NextResponse.json({ ok: true, already });
  } catch (e) {
    console.error("waitlist join failed:", e);
    return NextResponse.json({ ok: false, error: "could not save — try again" }, { status: 500 });
  }
}
