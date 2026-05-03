import { NextResponse } from "next/server";

export const revalidate = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: true, items: [] });

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (lazybullpro/1.0)" },
      next: { revalidate: 300 },
    });
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const j = await r.json();
    const items = (j.quotes || [])
      .filter((it: { symbol?: string }) => it.symbol)
      .map((it: { symbol: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string; typeDisp?: string }) => ({
        sym: it.symbol,
        name: it.shortname || it.longname || it.symbol,
        exch: it.exchange || "",
        type: it.typeDisp || it.quoteType || "",
      }));
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, items: [], error: (e as Error).message }, { status: 502 });
  }
}
