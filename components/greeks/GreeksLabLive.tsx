"use client";

// The compact Greeks lab on live data, for pages that are server components
// (the /learn primer): the same feed /greeks uses, the synthetic tape when the
// feed has nothing.

import { GreeksLab } from "./GreeksLab";
import { useLiveSpotVol } from "./useLiveSpotVol";

export function GreeksLabLive({ symbol, compact }: { symbol: string; compact?: boolean }) {
  const { spot, vol, source } = useLiveSpotVol(symbol);
  return <GreeksLab compact={compact} symbol={symbol} spot={spot} vol0={vol} source={source === "live" ? "LIVE" : "SIM"} />;
}
