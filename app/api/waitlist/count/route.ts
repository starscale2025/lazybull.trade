// GET /api/waitlist/count?tier=pro → { ok, tier, count } (or every tier's
// count without ?tier). Public: a tally, never an address. CDN-cached for a
// minute so the pricing page can show a real number without a Mongo read
// per visitor. The page only shows a tier's number once it reaches 10.

import { NextResponse } from "next/server";
import { WAITLIST_TIERS, waitlistCounts, type WaitlistTier } from "@/lib/db/waitlist";

export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(req: Request) {
  const tier = new URL(req.url).searchParams.get("tier");
  let counts: Record<WaitlistTier, number> = { plus: 0, pro: 0, power: 0 };
  let ok = true;
  try {
    counts = await waitlistCounts();
  } catch {
    // No database (local, keyless) → zeros; the page hides numbers under 10.
    ok = false;
  }
  if (tier && (WAITLIST_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ ok, tier, count: counts[tier as WaitlistTier] }, { headers: CACHE });
  }
  return NextResponse.json({ ok, counts }, { headers: CACHE });
}
