// The /trade route shell.
//
// WHY THIS FILE IS A SERVER COMPONENT and the whole builder now lives in
// ./workbench.tsx: `searchParams` reaches `generateMetadata` in page.js
// segments ONLY — never in a layout — and a client component may not export
// metadata at all. A shared trade's OG card is keyed on `?t=`, so the card
// cannot exist unless something server-side on THIS segment can read the
// query. This shell is that something, and it is deliberately the whole of it:
// every line of the builder is untouched in ./workbench.tsx.
//
// COST, stated plainly: awaiting searchParams opts /trade into dynamic
// rendering. The page never had server data to begin with (quotes, chain and
// bars are all client fetches), so what used to be a prerendered shell is now
// the same HTML rendered per request — no new database work, no new fetches.
// The static-shell version comes back for free the day cacheComponents/PPR is
// turned on in next.config.ts.
//
// The route's title/description/canonical stay in ./layout.tsx. This function
// adds the share card and NOTHING else — with no `t`, it returns an empty
// object and the layout's metadata is what ships, exactly as before.

import type { Metadata } from "next";
import { decodeLegs, MAX_SHARE_PARAM, ogImageUrl } from "@/lib/share-trade";
import { detect } from "@/lib/detector";
import { TradeWorkbench } from "./workbench";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** `?t=` as a single bounded string, or undefined. Arrays (`?t=a&t=b`) are junk. */
function shareParam(sp: { [key: string]: string | string[] | undefined }): string | undefined {
  const t = sp.t;
  if (typeof t !== "string" || !t || t.length > MAX_SHARE_PARAM) return undefined;
  return t;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = shareParam(await searchParams);
  const trade = t ? decodeLegs(t) : null;
  // Undecodable `t` is treated as no `t`: the page still renders, it just
  // shares as the normal /trade page rather than advertising a card that
  // would 400.
  if (!t || !trade) return {};

  const kind = detect(trade.legs).kind;
  const title = `${kind} on ${trade.underlying} — paper trade on lazybull`;
  const description = `${trade.legs.length}-leg ${kind.toLowerCase()}, ${trade.daysToExpiry} days out. Rebuild it in the builder and see the payoff, the odds and the max loss. Paper-only, never advice.`;
  const image = ogImageUrl(t);
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function TradePage({ searchParams }: Props) {
  return <TradeWorkbench sharedParam={shareParam(await searchParams)} />;
}
