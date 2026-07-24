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
    return NextResponse.json({
      ok: true,
      symbol,
      tf,
      source: res.provenance.provider, // back-compat: /quant reads j.source
      provenance: res.provenance,
      bars: res.bars,
      meta: res.meta,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, symbol, tf }, { status: 502 });
  }
}
