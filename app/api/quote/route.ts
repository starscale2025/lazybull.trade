import { NextResponse } from "next/server";
import { getProvider } from "@/lib/market-data";

// Historical/daily bars for the Quant workbench + the AI bots. All the vendor
// logic, caching, fallback chain and provenance now live behind the provider
// seam (lib/market-data); this route just adapts request → getBars → the
// response shape the frontend has always consumed:
//   { ok, symbol, tf, source, provenance, bars: [{i,t,o,h,l,c,v}], meta }
// On a total miss (no provider, no cache) it returns { ok:false } exactly as
// before, so the client's practice-tape fallback + calm reconnect banner are
// unchanged.
//
// Indian securities (lib/region.ts) come back already LAGGED by the orchestrator
// — the series ends ≥31 days ago and the response carries `delayed`, `asOf` and
// `policy` so the chart can label it. A lagged series with nothing left in it
// (an intraday timeframe, a listing younger than the window) is an honest
// { ok:false } with the policy named: the client falls to its practice tape,
// which is the synthetic alternative SEBI's education channel allows.

export const revalidate = 0; // the market-data layer owns caching now

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "AAPL").toUpperCase();
  const tf = searchParams.get("tf") || "D";

  try {
    const res = await getProvider().getBars(symbol, tf);
    if (!res) {
      // Tier D — no real data anywhere. Same contract as before → client synth.
      return NextResponse.json({ ok: false, error: "no data", symbol, tf }, { status: 502 });
    }
    if (res.delayed && res.bars.length < 2) {
      return NextResponse.json(
        { ok: false, error: "no data inside the education lag window", symbol, tf, delayed: true, policy: res.policy },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      symbol,
      tf,
      source: res.provenance.provider, // back-compat: /quant reads j.source
      provenance: res.provenance,
      bars: res.bars,
      meta: res.meta,
      ...(res.delayed ? { delayed: true, asOf: res.asOf, policy: res.policy } : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, symbol, tf }, { status: 502 });
  }
}
