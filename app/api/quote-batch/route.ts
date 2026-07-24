import { NextResponse } from "next/server";
import { getProvider } from "@/lib/market-data";

// The ticker + live-quote feed. Vendor logic, caching, gap-filling across
// providers (so indices like ^VIX still resolve when the primary can't) and
// provenance all live behind the provider seam now. Response shape is unchanged:
//   { ok:true, quotes: [{sym,name,last,chg,chgPct,currency,exch,marketState,marketTime}], provenance, source }
// so TickerBar, the hero HUD, LivingPage, the pro panels, portfolio, etc. keep
// working untouched.

export const revalidate = 0; // the market-data layer owns caching now

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Cap + de-dupe the fan-out: one unauthenticated GET must never explode into
  // hundreds of upstream calls.
  const MAX_SYMBOLS = 50;
  const symbols = [
    ...new Set(
      (searchParams.get("symbols") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, MAX_SYMBOLS);
  if (!symbols.length) return NextResponse.json({ ok: true, quotes: [] });

  try {
    const { quotes, provenance } = await getProvider().getQuotes(symbols);
    return NextResponse.json({ ok: true, quotes, provenance, source: provenance.provider });
  } catch (e) {
    // Never hard-fail the ticker — an empty set degrades gracefully (as before).
    return NextResponse.json({ ok: true, quotes: [], error: (e as Error).message });
  }
}
