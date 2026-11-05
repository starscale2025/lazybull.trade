import { NextResponse } from "next/server";
import { regionFromHeaders } from "@/lib/region";

// GET /api/region → { region: "IN" | "US" | … | null }
//
// Informational only. The banner copy ("prices for Indian securities are
// delayed 31 days here — SEBI education norms") wants to know whether it is
// talking to the beginner funnel, and this is the one place a client can ask.
// It is NOT a data gate: the lag policy in lib/region.ts applies to Indian
// SECURITIES regardless of viewer region, so nothing here can be spoofed into
// a live NSE print. No PII: a country code, never an IP.
//
// LAZYBULL_FORCE_REGION=IN overrides the geo header for local testing.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json(
    { region: regionFromHeaders(req.headers) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
