// /api/paper — per-user paper-account snapshot sync.
//   GET   my snapshot ({ rev, updatedAt, state|null })
//   PUT   replace it, optimistic-concurrency on `baseRev` (409 = conflict,
//         response carries the server copy so one round trip resolves it)
//   POST  same as PUT — navigator.sendBeacon can only POST, and the unload
//         flush uses it.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPaper, putPaper, PaperPutBody, MAX_SNAPSHOT_BYTES } from "@/lib/db/paper";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const doc = await getPaper(session.user.id);
  return NextResponse.json({ ok: true, ...doc });
}

async function upsert(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  try {
    const raw = await req.text();
    if (raw.length > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ ok: false, error: "snapshot too large" }, { status: 413 });
    }
    const { baseRev, state } = PaperPutBody.parse(JSON.parse(raw));
    const r = await putPaper(session.user.id, baseRev, state);
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "conflict", ...r.conflict }, { status: 409 });
    }
    return NextResponse.json({ ok: true, rev: r.rev });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  return upsert(req);
}

export async function POST(req: Request) {
  return upsert(req);
}
