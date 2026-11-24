import { NextResponse } from "next/server";
import { probeOvernight } from "@/lib/market-data";

// Observability only, like /api/status beside it: which of Alpaca's feeds this
// plan is served outside the regular US session, and how old their prices are
// (lib/market-data/overnight-probe.ts). One fixed symbol, nothing from the
// request reaches Alpaca, the report is kept for five minutes per instance,
// and no secrets come back. It answers "can the site move overnight on these
// keys?" without a redeploy.

export const revalidate = 0;

export async function GET() {
  return NextResponse.json(await probeOvernight(), { headers: { "Cache-Control": "no-store" } });
}
