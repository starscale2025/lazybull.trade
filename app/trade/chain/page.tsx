"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { OptionsChain } from "@/components/options-chain/OptionsChain";
import { StrategyCard } from "@/components/options-chain/StrategyCard";
import { PositionsPanel } from "@/components/options-chain/PositionsPanel";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { RiskWizard } from "@/components/safety/RiskWizard";
import { SafetySettingsButton } from "@/components/safety/KillSwitch";
import { useTeacher } from "@/lib/stores";
import { QuickBet } from "@/components/bet/QuickBet";

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
      <section className="relative border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative shell flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="t-eyebrow flex flex-wrap items-center gap-3">
            <span className="text-fg-faint">⟢ advanced view · raw chain</span>
            <h1 className="t-eyebrow text-fg">
              Drag across strikes. <span className="t-accent">Build</span> a strategy.
            </h1>
            <a href="/trade" className="text-bull hover:underline">← back to strategy builder</a>
          </div>
          <div className="flex items-center gap-2">
            <SafetySettingsButton />
            <button
              onClick={() =>
                setBubble({
                  title: "Hi, I'm your teacher",
                  body: "Hover any Greek label for an instant explanation. Drag across the chain to build multi-leg strategies. Click 'Explain this strategy' on the right card and I'll walk you through the trade in plain English.",
                  icon: "delta",
                })
              }
              className="inline-flex h-9 items-center gap-2 border border-bull bg-bull/10 px-3 font-mono text-[11px] uppercase tracking-wider text-bull hover:bg-bull/20"
            >
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              ask teacher
            </button>
          </div>
        </div>
      </section>

      {/* Symbol switcher */}
      <section className="border-b border-border bg-bg-soft">
        <div className="shell flex items-center gap-3 overflow-x-auto py-3 font-mono text-[11px] uppercase tracking-wider">
          <span className="text-fg-faint shrink-0">underlying</span>
          {SYMBOLS.map((s, i) => (
            <button
              key={s.sym}
              onClick={() => setSymIdx(i)}
              className={`shrink-0 border px-3 py-1 transition-colors ${
                i === symIdx
                  ? "border-bull bg-bull/10 text-bull"
                  : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
              }`}
            >
              {s.sym}
              <span className="ml-2 text-fg-faint">${s.spot.toFixed(2)}</span>
            </button>
          ))}
          <span className="ml-auto shrink-0 text-fg-dim flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" /> live spot{" "}
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
      <TeacherAvatar
        onAsk={() =>
          setBubble({
            title: "How can I help?",
            body: "Hover any Greek (Delta, Gamma, Theta, Vega, Rho) for an instant explanation. Drag across two or more cells to build a spread, then click 'Explain this strategy' for plain-English coaching.",
            icon: "delta",
          })
        }
      />

      {/* One-tap paper bet; the slip also reflects any legs built on the chain. */}
      <QuickBet symbol={sym.sym} spot={spot} />
    </main>
  );
}
