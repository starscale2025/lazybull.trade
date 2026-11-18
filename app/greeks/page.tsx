"use client";

// THE GREEKS LAB (plan A5, Stage 4). The page is the data around the lab:
// the symbol, its live spot and 60-day realised volatility through the quote
// proxy (useLiveSpotVol, shared with the /learn primer), and the one
// synthetic tape (lib/viz/tape.ts) when live data is not there. The lab itself is
// components/greeks/GreeksLab.tsx. The header is a single row, so the surface
// starts in the first third of a 1440x900 screen. Educational, not advice.

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink } from "@/components/calm/kit";
import { SourceChip } from "@/components/viz";
import { GreeksLab } from "@/components/greeks/GreeksLab";
import { useLiveSpotVol } from "@/components/greeks/useLiveSpotVol";

const SYMBOLS = ["AMZN", "AAPL", "TSLA", "NVDA", "SPY", "MSFT"] as const;
type Sym = (typeof SYMBOLS)[number];

export default function GreeksLabPage() {
  const [symbol, setSymbol] = useState<Sym>("AMZN");
  const { spot, vol, source, realized } = useLiveSpotVol(symbol);

  return (
    <div className="page-aura min-h-screen bg-bg">
      <Nav />
      <main className="shell pb-16 pt-[clamp(1.25rem,3vw,2rem)]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="t-eyebrow text-brand-ink">Greeks lab</p>
            <h1 className="mt-1 font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-tightest text-fg">See the price move.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="symbol-select" className="t-label text-fg-faint">
              Symbol
            </label>
            <select id="symbol-select" value={symbol} onChange={(e) => setSymbol(e.target.value as Sym)} className="calm-input !h-9 !pr-8">
              {SYMBOLS.map((s) => (
                <option key={s} value={s} className="bg-bg text-fg">
                  {s}
                </option>
              ))}
            </select>
            <SourceChip source={source === "live" ? "LIVE" : "SIM"} note={source === "live" ? (realized ? "realised 60d vol" : "synthetic vol") : "Black-Scholes"} />
          </div>
        </header>

        <GreeksLab symbol={symbol} spot={spot} vol0={vol} source={source === "live" ? "LIVE" : "SIM"} />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="t-label text-fg-faint">Black-Scholes, computed in your browser · Educational, not advice</p>
          <CalmLink href="/learn#greeks">Part of §06 in the primer</CalmLink>
        </div>
      </main>
      <Footer />
    </div>
  );
}
