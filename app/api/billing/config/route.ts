// GET /api/billing/config — what the pricing page needs to choose between a
// checkout button and a waitlist form: which rails are live, and a coarse
// region for the ₹ / $ default. Booleans and a two-letter code; no ids, no
// secrets. Public and uncached (the region is per request).

import { NextResponse } from "next/server";
import { providers } from "@/lib/billing/config";
import { regionFrom } from "@/lib/billing/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json(
    { ok: true, providers: providers(), region: regionFrom(req.headers) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
