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
import { GreekTrigger } from "@/components/ai-teacher/SpeechBubble";

const SYMBOLS = [
  { sym: "AMZN", name: "Amazon.com", spot: 226.45 },
  { sym: "NVDA", name: "Nvidia", spot: 138.9 },
  { sym: "TSLA", name: "Tesla", spot: 287.15 },
  { sym: "AAPL", name: "Apple", spot: 229.83 },
  { sym: "SPY", name: "S&P 500 ETF", spot: 612.4 },
];

export default function TradePage() {
  const [symIdx, setSymIdx] = useState(0);
  const [spot, setSpot] = useState(SYMBOLS[0].spot);
  const setBubble = useTeacher((s) => s.setBubble);

  // Random walk so the chain feels alive
  useEffect(() => {
    const id = setInterval(() => {
      setSpot((s) => {
        const drift = (Math.random() - 0.5) * 0.6;
        return Math.max(1, +(s + drift).toFixed(2));
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // When user changes symbol, reset spot
  useEffect(() => {
    setSpot(SYMBOLS[symIdx].spot);
  }, [symIdx]);

  const sym = SYMBOLS[symIdx];

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* page header */}
      <section className="relative border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-5 py-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint flex items-center gap-3">
              ⟢ advanced view · raw chain
              <a href="/trade" className="text-bull hover:underline">← back to bet builder</a>
            </div>
            <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.6rem)] tracking-tightest leading-[0.95]">
              Drag across strikes.
              <br />
              <span className="italic font-light text-bull">Build</span> a strategy.
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm text-fg-dim leading-relaxed">
              Hover any{" "}
              <GreekTrigger greek="delta">greek</GreekTrigger> for an instant explanation. Drag across cells to compose
              spreads, condors, and straddles. The card to the right detects the strategy, computes the P&L, and lets
              you paper-trade it.
            </p>
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
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 overflow-x-auto px-5 py-3 font-mono text-[11px] uppercase tracking-wider">
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
            <span className="text-fg tabular-nums">${spot.toFixed(2)}</span>
          </span>
        </div>
      </section>

      {/* Main grid */}
      <section className="mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-5 px-5 py-6">
        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
          <OptionsChain underlying={sym.sym} spot={spot} />
        </div>
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          <StrategyCard underlying={sym.sym} spot={spot} />
          <PositionsPanel spot={spot} />
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
    </main>
  );
}
