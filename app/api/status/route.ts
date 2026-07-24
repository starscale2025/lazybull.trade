import { NextResponse } from "next/server";
import { marketDataStatus } from "@/lib/market-data";

// Observability only — the live state of the market-data layer: the provider
// chain, which providers are configured, each one's circuit-breaker health +
// last success/error, and the cache backend. No secrets, no market data. Handy
// for "why is the ticker on Tier B right now?" without redeploying.

export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ ok: true, at: Date.now(), ...marketDataStatus() });
}
