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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const col = (await db()).collection("watchlists");
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
    const col = (await db()).collection("watchlists");
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
