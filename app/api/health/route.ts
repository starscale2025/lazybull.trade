// GET /api/health
//
// Reports liveness of the Next.js process and the Mongo cluster.
// Useful as a status endpoint and as a sanity check that .env.local is wired.

import { NextResponse } from "next/server";
import { pingMongo } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const mongoStatus = await pingMongo();
    return NextResponse.json({
      ok: true,
      uptimeS: Math.round(process.uptime()),
      mongo: { ...mongoStatus, latencyMs: Date.now() - t0 },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        mongo: { ok: false, error: (err as Error).message, latencyMs: Date.now() - t0 },
      },
      { status: 503 },
    );
  }
}
