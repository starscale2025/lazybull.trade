// /api/watchlists
//   GET   read mine ({ symbols: ["NVDA","AAPL", …] })
//   PUT   upsert mine

import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongo";

export const dynamic = "force-dynamic";

const Body = z.object({
  symbols: z.array(z.string().min(1).max(20)).max(100),
});

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection("watchlists");
  // AWAITED, not fire-and-forget: the PUT upsert relies on the unique index to
  // turn a two-request race into a duplicate-key error — without the index that
  // race would insert a SECOND watchlist doc. scripts/init-mongo.ts provisions
  // it too, but the route must not depend on init-mongo having run. Failure is
  // still non-fatal (reads work), just once per process.
  indexReady ??= c.createIndex({ userId: 1 }, { unique: true }).catch(() => {});
  await indexReady;
  return c;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const col = await coll();
  const doc = await col.findOne({ userId: new ObjectId(session.user.id) });
  return NextResponse.json({ ok: true, symbols: doc?.symbols ?? [] });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  try {
    const { symbols } = Body.parse(await req.json());
    const col = await coll();
    await col.updateOne(
      { userId: new ObjectId(session.user.id) },
      { $set: { symbols, updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, symbols });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 },
    );
  }
}
