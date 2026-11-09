"use client";

import { RegulatoryLine } from "@/components/RegulatoryLine";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { TruthBadge } from "@/components/pro/TruthBadge";
import { TickerBar } from "@/components/TickerBar";
import { OptionsChain } from "@/components/options-chain/OptionsChain";
import { StrategyCard } from "@/components/options-chain/StrategyCard";
import { PositionsPanel } from "@/components/options-chain/PositionsPanel";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { RiskWizard } from "@/components/safety/RiskWizard";
import { SafetySettingsButton } from "@/components/safety/KillSwitch";
import { useTeacher } from "@/lib/stores";
import { QuickBet } from "@/components/bet/QuickBet";
import { Chip, TogglePill, ToolButton } from "@/components/calm/kit";

const SYMBOLS = [
  { sym: "AMZN", name: "Amazon.com", spot: 226.45 },
  { sym: "NVDA", name: "Nvidia", spot: 138.9 },
  { sym: "TSLA", name: "Tesla", spot: 287.15 },
  { sym: "AAPL", name: "Apple", spot: 229.83 },
  { sym: "SPY", name: "S&P 500 ETF", spot: 612.4 },
];
const SYM_LIST = SYMBOLS.map((s) => s.sym).join(",");

export default function TradePage() {
  const [symIdx, setSymIdx] = useState(0);
  const [liveSpots, setLiveSpots] = useState<Record<string, number>>({});
  const sym = SYMBOLS[symIdx];
  const spot = liveSpots[sym.sym] ?? sym.spot;
  const setBubble = useTeacher((s) => s.setBubble);

  // Live spot — real Yahoo quotes via /api/quote-batch every 10s.
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${SYM_LIST}`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.quotes)) {
          const next: Record<string, number> = {};
          for (const q of j.quotes) if (q?.last) next[q.sym] = q.last;
          setLiveSpots(next);
        }
      } catch {
        /* keep prior on transient error */
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* page header — one compact row; the tool is the hero here */}
      <section className="border-b border-border bg-bg">
        <div className="shell flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="t-eyebrow flex flex-wrap items-center gap-3">
            <span className="text-fg-faint">Advanced view · raw chain</span>
            <h1 className="t-eyebrow text-fg">
              Drag across strikes. <span className="t-accent">Build</span> a strategy.
            </h1>
            <a href="/trade" className="calm-link !text-[0.875rem]"><span aria-hidden>‹</span> Back to strategy builder</a>
          </div>
          <div className="flex items-center gap-2">
            {/* Provenance where the data is (it left the site-wide nav in the
                calm pass, M33): this chain is synthetic, and says so here. */}
            <TruthBadge />
            <SafetySettingsButton />
            <ToolButton
              onClick={() =>
                setBubble({
                  title: "Hi, I'm your teacher",
                  body: "Hover any Greek label for an instant explanation. Drag across the chain to build multi-leg strategies. Click 'Explain this strategy' on the strategy card and I'll walk you through the trade in plain English.",
                  icon: "delta",
                })
              }
            >
              Ask teacher
            </ToolButton>
          </div>
        </div>
      </section>

      {/* Symbol switcher */}
      <section className="border-b border-border bg-bg-soft">
        <div className="shell flex items-center gap-3 overflow-x-auto py-3 t-label">
          <span className="text-fg-faint shrink-0">Underlying</span>
          {SYMBOLS.map((s, i) => (
            <TogglePill key={s.sym} on={i === symIdx} onClick={() => setSymIdx(i)} className="shrink-0">
              {s.sym}
              <span className="ml-2 opacity-60">${s.spot.toFixed(2)}</span>
            </TogglePill>
          ))}
          <span className="ml-auto shrink-0 text-fg-dim flex items-center gap-2">
            {/* "live" only over a real quote; the seed price says what it is (Gate A4 #1). */}
            {liveSpots[sym.sym] != null ? <Chip dot>Live spot</Chip> : <Chip dot tone="warn">Spot · SIM</Chip>}
            <span className="t-data text-fg">${spot.toFixed(2)}</span>
          </span>
        </div>
      </section>

      {/* Main grid */}
      <section className="shell grid grid-cols-12 gap-5 py-6">
        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
          <OptionsChain underlying={sym.sym} spot={spot} />
        </div>
        {/* pb-32 clears the fixed QuickBet dock so PositionsPanel close
            buttons stay reachable at the end of the scroll */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-5 pb-32">
          <StrategyCard underlying={sym.sym} spot={spot} />
          <PositionsPanel spot={spot} symbol={sym.sym} />
        </div>
      </section>

      <RiskWizard />
      <RegulatoryLine className="px-5 pb-36 pt-4" />

      <TeacherAvatar
        onAsk={() =>
          setBubble({
            title: "How can I help?",
            body: "Hover any Greek (Delta, Gamma, Theta, Vega, Rho) for an instant explanation. Drag across two or more cells to build a spread, then click 'Explain this strategy' for plain-English coaching.",
            icon: "delta",
          })
        }
      />

      {/* One-tap paper trade; the slip also reflects any legs built on the chain. */}
      <QuickBet symbol={sym.sym} spot={spot} />
    </main>
  );
}
