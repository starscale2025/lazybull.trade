"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { ProbabilityCone } from "@/components/wedge/ProbabilityCone";
import { StrategyCards } from "@/components/wedge/StrategyCards";
import { PlainGreeks } from "@/components/wedge/PlainGreeks";
import { TimeMachine } from "@/components/wedge/TimeMachine";
import { EventTimeline } from "@/components/wedge/EventTimeline";
import { ModelSpread } from "@/components/wedge/ModelSpread";
import { ManagePanel } from "@/components/wedge/ManagePanel";
import { storySentence, type Bet } from "@/components/wedge/PositionStory";
import { generateStrategies, probBS, type Strategy } from "@/lib/models";
import { eventsFor } from "@/lib/events";

// IV is still synthetic (no free options-IV feed); spot is now live.
const SYMBOLS = [
  { sym: "AMZN", name: "Amazon", spot: 226.45, iv: 0.32 },
  { sym: "NVDA", name: "Nvidia", spot: 138.9, iv: 0.46 },
  { sym: "TSLA", name: "Tesla", spot: 287.15, iv: 0.55 },
  { sym: "AAPL", name: "Apple", spot: 229.83, iv: 0.28 },
  { sym: "SPY", name: "S&P 500", spot: 612.4, iv: 0.16 },
];
const SYM_LIST = SYMBOLS.map((s) => s.sym).join(",");

function dateNDaysOut(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export default function TradePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [symIdx, setSymIdx] = useState(0);
  const sym = SYMBOLS[symIdx];

  // Live spot — polls /api/quote-batch for real Yahoo prices.
  const [liveSpots, setLiveSpots] = useState<Record<string, number>>({});
  const spot = liveSpots[sym.sym] ?? sym.spot;

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
        /* keep prior values on transient error */
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Historical daily bars from Yahoo (real). Falls back to a deterministic
  // walk only if the fetch fails.
  const [histBars, setHistBars] = useState<{ i: number; t: number; c: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${sym.sym}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          const last60 = j.bars.slice(-60).map((b: { t: number; c: number }, i: number) => ({ i, t: b.t, c: b.c }));
          setHistBars(last60);
          return;
        }
      } catch {
        /* fall through to synthetic fallback */
      }
      // Fallback only if Yahoo fails.
      const out: { i: number; t: number; c: number }[] = [];
      let s = sym.spot * 0.92;
      let seed = sym.sym.charCodeAt(0) * 31 + sym.sym.charCodeAt(1) * 7;
      const rand = () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let r = seed;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
      const baseTime = Date.now() - 60 * 86_400_000;
      for (let i = 0; i < 60; i++) {
        const drift = 0.001 + Math.sin(i / 14) * 0.004;
        s = s * (1 + (rand() - 0.5) * 0.018 + drift);
        out.push({ i, t: baseTime + i * 86_400_000, c: s });
      }
      out[out.length - 1].c = sym.spot;
      setHistBars(out);
    })();
    return () => { cancelled = true; };
  }, [sym]);

  // thesis
  const [low, setLow] = useState(sym.spot * 0.95);
  const [high, setHigh] = useState(sym.spot * 1.06);
  const [days, setDays] = useState(35);

  useEffect(() => {
    setLow(sym.spot * 0.95);
    setHigh(sym.spot * 1.06);
    setDays(35);
  }, [sym]);

  const probInBand = probBS({ spot, low, high, daysToExpiry: days, iv: sym.iv });

  // strategies
  const strategies = useMemo(
    () => generateStrategies({ spot, low, high, daysToExpiry: days, iv: sym.iv }),
    [spot, low, high, days, sym.iv]
  );
  const [selectedId, setSelectedId] = useState<Strategy["id"] | null>("income");
  const selected = strategies.find((s) => s.id === selectedId) ?? null;

  // events
  const events = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    return eventsFor(sym.sym, start, end);
  }, [sym, days]);

  // bets / positions
  const [bets, setBets] = useState<Bet[]>([]);
  const [confirm, setConfirm] = useState<Bet | null>(null);
  const [recentlyPlaced, setRecentlyPlaced] = useState<Bet | null>(null);

  const placeBet = (s: Strategy) => {
    const expiry = fmtDate(dateNDaysOut(days));
    const b: Bet = {
      id: `bet-${Date.now()}`,
      symbol: sym.sym,
      strategy: s,
      thesisLow: low,
      thesisHigh: high,
      expiry,
      spotAtOpen: spot,
      openedAt: Date.now(),
      cost: s.cost,
      status: "open",
    };
    setConfirm(b);
  };
  const confirmBet = () => {
    if (!confirm) return;
    setBets((cur) => [confirm, ...cur]);
    setRecentlyPlaced(confirm);
    setConfirm(null);
    setTimeout(() => setRecentlyPlaced(null), 3500);
  };

  // thesis sentence
  const direction = (() => {
    const mid = (low + high) / 2;
    if (mid > spot * 1.03) return "rise into";
    if (mid < spot * 0.97) return "fall into";
    return "close between";
  })();
  const thesisSentence = `I think ${sym.sym} will ${direction} $${low.toFixed(2)} and $${high.toFixed(2)} by ${fmtDate(dateNDaysOut(days))}.`;

  // narrate via /api/explain (LLM only narrates, never predicts probabilities)
  const [narration, setNarration] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  const narrate = async (s: Strategy) => {
    setNarrating(true);
    setNarration(null);
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: s.kind,
          bias: s.bias,
          defined: Number.isFinite(s.maxLoss),
          net: s.cost > 0 ? "debit" : "credit",
          maxProfit: s.maxProfit,
          maxLoss: s.maxLoss,
          breakevens: s.breakevens,
          spot,
          underlying: sym.sym,
        }),
      });
      const j = await r.json();
      setNarration(j.text || null);
    } finally {
      setNarrating(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* Header */}
      <section className="relative border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-5 py-6">
          <div>
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ bet builder · v2
              <Link href="/trade/chain" className="text-bull hover:underline">advanced view: see the chain →</Link>
            </div>
            <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.6rem)] tracking-tightest leading-[1]">
              Stop showing the chain.
              <span className="italic font-light text-bull"> Show the bet.</span>
            </h1>
          </div>

          {/* symbol switcher */}
          <div className="flex items-center gap-1 overflow-x-auto font-mono text-[11px] uppercase tracking-wider">
            <span className="shrink-0 text-fg-faint mr-2">underlying</span>
            {SYMBOLS.map((s, i) => (
              <button
                key={s.sym}
                onClick={() => setSymIdx(i)}
                className={`shrink-0 border px-3 py-1 transition-colors ${
                  i === symIdx ? "border-bull bg-bull/10 text-bull" : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
                }`}
              >
                {s.sym} <span className="ml-1 text-fg-faint tabular-nums">${s.spot.toFixed(2)}</span>
              </button>
            ))}
            <span className="ml-3 flex shrink-0 items-center gap-2 text-fg-dim">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" /> live ${spot.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Step 1 — Thesis */}
      <section className="relative border-b border-border">
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-x-5 gap-y-6 px-5 py-8">
          <div className="col-span-12 lg:col-span-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">⟢ Step 01 / Thesis</div>
            <h2 className="mt-2 font-display text-[clamp(2rem,4.5vw,3.8rem)] tracking-tightest leading-[1]">
              <span className="text-fg-dim italic">"</span>
              <ThesisLine sentence={thesisSentence} />
              <span className="text-fg-dim italic">"</span>
            </h2>
            <p className="mt-3 max-w-[60ch] text-sm text-fg-dim">
              Drag the green band on the chart up or down to change your price zone.
              Drag the orange line ↔ to change the date. The whole app rebuilds around it.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5 flex flex-col items-end justify-end gap-3">
            <ProbabilityRing prob={probInBand} />
            <div className="font-mono text-[11px] uppercase tracking-wider text-fg-faint text-right max-w-[26ch]">
              Black-Scholes risk-neutral odds your stock lands inside the band by expiry.
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] px-5 pb-8">
          <div className="h-[420px] border border-border bg-bg">
            {mounted ? (
              <ProbabilityCone
                bars={histBars}
                spot={spot}
                iv={sym.iv}
                daysToExpiry={days}
                low={low}
                high={high}
                onChangeLow={setLow}
                onChangeHigh={setHigh}
                onChangeDays={setDays}
                events={events}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">loading forecast cone…</div>
            )}
          </div>
        </div>
      </section>

      {/* Step 2 — Strategy cards */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">⟢ Step 02 / Pick your bet</div>
              <h2 className="mt-2 font-display text-[clamp(1.8rem,3.6vw,3rem)] tracking-tightest leading-[1.05]">
                Three ways to bet on it.
              </h2>
            </div>
            <button
              onClick={() => selected && narrate(selected)}
              className="inline-flex items-center gap-2 border border-bull/40 bg-bull/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bull hover:bg-bull/20"
            >
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              ask the teacher to explain {selected ? `"${selected.kind}"` : "this"}
            </button>
          </div>

          <StrategyCards
            strategies={strategies}
            selectedId={selectedId}
            onSelect={(s) => setSelectedId(s.id)}
            onPlace={(s) => { setSelectedId(s.id); placeBet(s); }}
            spot={spot}
            symbol={sym.sym}
          />

          {/* AI narration appears under cards */}
          <AnimatePresence>
            {(narrating || narration) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-px border border-bull/40 bg-bull/5 p-5"
              >
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-bull">teacher · plain English</div>
                {narrating && <div className="text-fg-faint font-mono text-[11px]">teacher is thinking…</div>}
                {!narrating && narration && (
                  <p className="text-[14px] leading-relaxed text-fg whitespace-pre-line">{narration}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Step 3 — Under the hood */}
      <section className="relative border-b border-border bg-bg">
        <div className="mx-auto max-w-[1400px] px-5 py-10">
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">⟢ Step 03 / Under the hood</div>
            <h2 className="mt-2 font-display text-[clamp(1.8rem,3.6vw,3rem)] tracking-tightest leading-[1.05]">
              The math, in a language you speak.
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-5">
              <PlainGreeks s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} />
              <TimeMachine s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} />
            </div>
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-5">
              {mounted && <EventTimeline events={events} daysToExpiry={days} baseDate={new Date()} />}
              {mounted && <ModelSpread spot={spot} low={low} high={high} daysToExpiry={days} iv={sym.iv} />}
            </div>
          </div>
        </div>
      </section>

      {/* Step 4 — Manage */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1400px] px-5 py-10">
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">⟢ Step 04 / Manage</div>
            <h2 className="mt-2 font-display text-[clamp(1.8rem,3.6vw,3rem)] tracking-tightest leading-[1.05]">
              Where every other app abandons you. We don't.
            </h2>
          </div>
          <ManagePanel
            bets={bets}
            liveSpot={spot}
            iv={sym.iv}
            onClose={(id, pnl) =>
              setBets((cur) => cur.map((b) => (b.id === id ? { ...b, status: "closed", closedPnl: pnl } : b)))
            }
            onRoll={() => alert("Roll preview — extending to next monthly expiry. Coming soon as a real flow.")}
          />
        </div>
      </section>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirm(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl border border-bull/40 bg-bg shadow-[0_30px_100px_-20px_rgba(0,255,135,0.5)]"
            >
              <div className="border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-bull">
                ⚡ confirm bet · {sym.sym}
              </div>
              <div className="p-6">
                <div className="font-display text-2xl tracking-tightest text-fg">{confirm.strategy.kind}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-fg">{storySentence(confirm)}</p>
                <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
                  {[
                    { k: "max profit", v: Number.isFinite(confirm.strategy.maxProfit) ? `+$${confirm.strategy.maxProfit.toFixed(0)}` : "uncapped", c: "text-bull" },
                    { k: "max loss", v: Number.isFinite(confirm.strategy.maxLoss) ? `−$${Math.abs(confirm.strategy.maxLoss).toFixed(0)}` : "unbounded", c: "text-bear" },
                    { k: "win odds", v: `${(confirm.strategy.prob * 100).toFixed(0)}%`, c: "text-fg" },
                  ].map((s) => (
                    <div key={s.k} className="bg-bg p-3">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{s.k}</div>
                      <div className={`mt-1 font-mono text-base tabular-nums ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button onClick={() => setConfirm(null)} className="border border-border bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg">cancel</button>
                  <button onClick={confirmBet} className="bg-bull px-5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim">place this bet</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently placed toast */}
      <AnimatePresence>
        {recentlyPlaced && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 border border-bull/60 bg-bull/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bull shadow-2xl"
          >
            ✓ bet placed · scroll down to manage
          </motion.div>
        )}
      </AnimatePresence>

      <TeacherAvatar />
    </main>
  );
}

function ThesisLine({ sentence }: { sentence: string }) {
  // Highlight the price band and date
  const parts = sentence.split(/(\$[\d.]+|by [^.]+)/g);
  return (
    <span className="text-fg">
      {parts.map((p, i) => {
        if (p.startsWith("$")) return <span key={i} className="text-bull">{p}</span>;
        if (p.startsWith("by ")) return <span key={i} className="text-amber">{p}</span>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function ProbabilityRing({ prob }: { prob: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = c * prob;
  const tone = prob > 0.6 ? "var(--bull)" : prob > 0.35 ? "var(--cyan)" : "var(--bear)";
  return (
    <div className="flex items-center gap-3 border border-border bg-surface px-4 py-3">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} stroke="var(--border)" strokeWidth="6" fill="none" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          stroke={tone}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - filled }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div>
        <div className="font-display text-3xl tracking-tightest tabular-nums" style={{ color: tone }}>
          {(prob * 100).toFixed(0)}%
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">odds in band · BS</div>
      </div>
    </div>
  );
}
