"use client";

import { RegulatoryLine } from "@/components/RegulatoryLine";
import { useEffect, useState, type CSSProperties } from "react";
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

/** deck-rise's stagger slot (globals.css, THE DECK SKIN). Only ever on the
    header's text: deck-rise animates transform, and a box holding one of the
    page's inline `fixed` dialogs (Safety, the pre-trade check) must never
    carry it, or the dialog would be laid out inside that box. */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

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
    // `deck`: the pitch deck's palette for everything inside (globals.css,
    // THE DECK SKIN); `tap-floor`: 44px touch targets, as on /trade.
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* page header — the deck's way: the eyebrow, one display line, the
          provenance under it. Still compact: the tool is the hero here. */}
      <section className="border-b border-border">
        <div className="shell flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5 pt-6 md:pt-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <p className="deck-eyebrow deck-rise">Advanced view · raw chain</p>
              <a href="/trade" className="deck-link deck-rise text-[0.8125rem]" style={rise(1)}>
                <span aria-hidden>‹</span> Back to strategy builder
              </a>
            </div>
            <h1 className="deck-h2 deck-rise mt-3 text-fg" style={rise(1)}>
              Drag across strikes. <span className="deck-accent">Build a strategy.</span>
            </h1>
            {/* Provenance where the data is (it left the site-wide nav in the
                calm pass, M33): this chain is synthetic, and says so here — one
                quiet line under the title, the honesty ledger behind it. */}
            <div className="deck-rise mt-3 text-[0.8125rem]" style={rise(2)}>
              <TruthBadge quiet />
            </div>
          </div>
          <div className="flex items-center gap-2">
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
      <section className="border-b border-border">
        <div className="shell flex items-center gap-2 overflow-x-auto overscroll-x-contain py-3">
          <span className="deck-label mr-2 shrink-0">Underlying</span>
          {SYMBOLS.map((s, i) => (
            <TogglePill key={s.sym} on={i === symIdx} onClick={() => setSymIdx(i)} className="shrink-0">
              {s.sym}
              {/* opacity-75, not 60: on an idle pill (bone-dim on ink) 60%
                  set the figure at 4.3:1, under AA for type this small; 75%
                  clears it there (6.3:1) and on the pressed bone pill (9.4:1). */}
              <span className="ml-2 t-data text-[0.75rem] opacity-75">${s.spot.toFixed(2)}</span>
            </TogglePill>
          ))}
          <span className="ml-auto flex shrink-0 items-center gap-2.5 pl-4">
            {/* "live" only over a real quote; the seed price says what it is (Gate A4 #1). */}
            {liveSpots[sym.sym] != null ? <Chip dot>Live spot</Chip> : <Chip dot tone="warn">Spot · SIM</Chip>}
            <span className="t-data text-[0.9375rem] text-fg">${spot.toFixed(2)}</span>
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
