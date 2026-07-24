"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { AmbientOrbs } from "@/components/atmosphere/AmbientOrbs";
import { CursorSpotlight } from "@/components/atmosphere/CursorSpotlight";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ProbabilityCone } from "@/components/wedge/ProbabilityCone";
import { StrategyCards, PnlSparkline, STRATEGY_TONE } from "@/components/wedge/StrategyCards";
import { PlainGreeks } from "@/components/wedge/PlainGreeks";
import { TimeMachine } from "@/components/wedge/TimeMachine";
import { EventTimeline } from "@/components/wedge/EventTimeline";
import { ModelSpread } from "@/components/wedge/ModelSpread";
import { ManagePanel } from "@/components/wedge/ManagePanel";
import { ChainTable } from "@/components/wedge/ChainTable";
import { BetBar } from "@/components/wedge/BetSlip";
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

type LiveQuote = { last: number; chg: number; chgPct: number; name?: string; exch?: string };

function dateNDaysOut(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// The "under the hood" analytics panels, one at a time (progressive disclosure).
const TABS = [
  { id: "whatif", label: "What-if machine" },
  { id: "events", label: "Event horizon" },
  { id: "models", label: "Model spread" },
  { id: "manage", label: "Positions" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function TradePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [symIdx, setSymIdx] = useState(0);
  const sym = SYMBOLS[symIdx];

  // Live quotes — polls /api/quote-batch for real Yahoo prices (+ change/exchange).
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});
  const quote = liveQuotes[sym.sym];
  const spot = quote?.last ?? sym.spot;

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${SYM_LIST}`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.quotes)) {
          const next: Record<string, LiveQuote> = {};
          for (const q of j.quotes)
            if (q?.last)
              next[q.sym] = { last: q.last, chg: q.chg ?? 0, chgPct: q.chgPct ?? 0, name: q.name, exch: q.exch };
          setLiveQuotes(next);
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

  // Change readout: real quote change when available, else derived from the
  // last two historical closes.
  const prevClose = histBars.length > 1 ? histBars[histBars.length - 2].c : spot;
  const chg = quote?.chg ?? spot - prevClose;
  const chgPct = quote?.chgPct ?? (prevClose ? ((spot - prevClose) / prevClose) * 100 : 0);

  // Header stat cluster — IV rank/percentile are derived from the synthetic
  // base IV (no real IV-history feed), so the whole cluster carries an
  // "illustrative" tag, same convention as the Source: Mock chips.
  const symSeed = sym.sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const ivRank = Math.round(Math.min(98, Math.max(2, ((sym.iv - 0.12) / (0.55 - 0.12)) * 100)));
  const ivPctile = Math.round(Math.min(98, Math.max(2, ivRank + ((symSeed % 13) - 6))));

  // Next earnings from the same deterministic event calendar the timeline uses.
  const nextEarnings = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 120);
    return eventsFor(sym.sym, start, end).find((e) => e.kind === "earnings") ?? null;
  }, [sym]);
  const earnDays = nextEarnings
    ? Math.max(0, Math.ceil((new Date(nextEarnings.date).getTime() - Date.now()) / 86_400_000))
    : null;
  const earnLabel = nextEarnings
    ? new Date(nextEarnings.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()
    : "—";

  // thesis
  const [low, setLow] = useState(sym.spot * 0.95);
  const [high, setHigh] = useState(sym.spot * 1.06);
  const [days, setDays] = useState(35);

  // The SYMBOLS seed spots are stale (late-2024 prices), and this effect used to
  // anchor the band to `sym.spot` on symbol change ONLY — it never re-ran when
  // the live quote landed. Every symbol therefore opened with its band entirely
  // below spot, which made the thesis read "fall into $x–$y" for all of them,
  // dropped the in-band probability to 0–30%, and built an all-bearish strategy
  // menu from a band the user never chose.
  //
  // The pre-quote anchor is provisional; re-anchor once the first live quote for
  // this symbol arrives, then leave the band alone so the 10s poll can't stomp a
  // band the user has dragged.
  const anchoredRef = useRef<string | null>(null);
  useEffect(() => {
    const stamp = `${sym.sym}:${quote ? "live" : "seed"}`;
    if (anchoredRef.current === `${sym.sym}:live` || anchoredRef.current === stamp) return;
    anchoredRef.current = stamp;
    setLow(spot * 0.95);
    setHigh(spot * 1.06);
    setDays(35);
  }, [sym.sym, quote, spot]);

  const resetView = () => {
    setLow(spot * 0.95);
    setHigh(spot * 1.06);
    setDays(35);
  };

  const probInBand = probBS({ spot, low, high, daysToExpiry: days, iv: sym.iv });

  // chain depth (strikes each side of ATM) — drives the chain table
  const [chainDepth, setChainDepth] = useState(5);

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
  const openCount = bets.filter((b) => b.status === "open").length;

  const placeBet = (s: Strategy) => {
    const expiryDate = dateNDaysOut(days);
    const b: Bet = {
      id: `bet-${Date.now()}`,
      symbol: sym.sym,
      strategy: s,
      thesisLow: low,
      thesisHigh: high,
      expiry: fmtDate(expiryDate),
      expiryTs: expiryDate.getTime(),
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

  // under-the-hood tabs
  const [tab, setTab] = useState<TabId>("whatif");

  const expiryStr = fmtDate(dateNDaysOut(days));

  // narrate via /api/explain (LLM only narrates, never predicts probabilities).
  // The endpoint takes a fixed position payload — questions from the teacher
  // input re-run the same explanation flow for the current position.
  const [narrating, setNarrating] = useState(false);
  const [thread, setThread] = useState<{ role: "user" | "teacher"; text: string }[]>([]);
  const narrate = async (s: Strategy, question?: string) => {
    if (question) setThread((cur) => [...cur, { role: "user", text: question }]);
    setNarrating(true);
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
      if (j.text) setThread((cur) => [...cur, { role: "teacher", text: j.text }]);
    } finally {
      setNarrating(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-bg pb-20 text-fg lg:pb-0">
      {/* the homepage's atmosphere language, carried through */}
      <AmbientOrbs />
      <CursorSpotlight />
      <ScrollProgress />
      <div className="pointer-events-none fixed inset-0 z-40 scanlines opacity-[0.09]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0 z-40"
        aria-hidden
        style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.45) 100%)" }}
      />
      <TickerBar />
      <Nav />

      {/* ── App shell: on lg+ everything below the nav fits one screen and panels
             scroll internally. 91px = measured TickerBar (33.5px) + Nav (57px). */}
      <div className="flex flex-col lg:h-[calc(100vh-91px)] lg:overflow-hidden">
      {/* ── Header row: symbol · price · change | IV cluster · earnings · paper badge */}
      <section className="relative overflow-hidden border-b border-border bg-bg lg:shrink-0">
        <img
          src="/media/trade/chip-hero@1600.webp"
          srcSet="/media/trade/chip-hero@800.webp 800w, /media/trade/chip-hero@1600.webp 1600w"
          sizes="100vw"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-[0.18]"
          style={{ maskImage: "linear-gradient(to left, black 30%, transparent 78%)" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-4 lg:py-2">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-2">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint" data-gsap="fade-up">
              ⟢ bet builder · v2
              <Link href="/trade/chain" className="text-bull hover:underline">advanced view: see the chain →</Link>
            </div>
            <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bull">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              paper only · $5k practice account
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 lg:mt-1.5 lg:items-center">
            {/* symbol block — one dense baseline row on lg */}
            <div className="lg:flex lg:flex-wrap lg:items-baseline lg:gap-x-4" data-gsap="fade-up">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-[clamp(1.9rem,3vw,2.6rem)] leading-none tracking-tightest text-fg lg:text-[1.7rem]" style={{ textShadow: "0 0 32px rgba(0,255,135,0.12)" }}>
                  {sym.sym}
                </h1>
                <span className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">{quote?.name ?? sym.name}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-3 font-mono tabular-nums lg:mt-0">
                <span className="text-2xl text-fg lg:text-xl">${spot.toFixed(2)}</span>
                <span className={`text-sm ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                  {chg >= 0 ? "+" : "−"}{Math.abs(chg).toFixed(2)} ({chg >= 0 ? "+" : "−"}{Math.abs(chgPct).toFixed(2)}%)
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint lg:mt-0">
                <span className={`size-1.5 rounded-full ${quote ? "bg-bull pulse-dot" : "bg-amber"}`} />
                {quote ? `live price · ${quote.exch ?? "us market"}` : "seed price · connecting"}
              </div>
            </div>

            {/* IV / earnings cluster — synthetic, tagged illustrative */}
            <div className="flex flex-col items-start gap-2 sm:items-end lg:flex-row lg:items-center lg:gap-3" data-gsap="fade-up" data-gsap-delay="0.08">
              <div className="flex divide-x divide-border font-mono">
                {[
                  { k: "iv rank", v: String(ivRank) },
                  { k: "iv percentile", v: `${ivPctile}%` },
                  { k: "iv", v: `${(sym.iv * 100).toFixed(1)}%` },
                ].map((s) => (
                  <div key={s.k} className="px-4 text-right first:pl-0">
                    <div className="text-[10px] uppercase tracking-wider text-fg-faint">{s.k}</div>
                    <div className="mt-1 text-lg tabular-nums text-fg lg:mt-0.5 lg:text-base">{s.v}</div>
                  </div>
                ))}
                <div className="px-4 pr-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-fg-faint">earnings</div>
                  <div className="mt-1 flex items-baseline justify-end gap-1.5 lg:mt-0.5">
                    <span className="text-lg tabular-nums text-fg lg:text-base">{earnLabel}</span>
                    {earnDays != null && (
                      <span className="border border-bull/40 bg-bull/10 px-1 py-px text-[10px] uppercase tracking-wider text-bull">
                        {earnDays}d
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
                <span className="size-1 rounded-full bg-amber" />
                illustrative · synthetic iv
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Terminal grid: chart + chain (≈60%) | strategy · greeks · teacher (≈40%) */}
      <div className="relative mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-4 px-5 py-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-3 lg:overflow-hidden lg:py-3">
        {/* ---- left column: toolbar → cone chart → chain (internal scroll) ---- */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:gap-3 lg:overflow-hidden">
          {/* toolbar strip — live controls only */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider lg:shrink-0 lg:flex-nowrap lg:gap-x-3 lg:overflow-x-auto">
            <span className="text-fg-faint">underlying</span>
            <div className="flex items-center gap-1">
              {SYMBOLS.map((s, i) => (
                <button
                  key={s.sym}
                  onClick={() => setSymIdx(i)}
                  className={`border px-2 py-0.5 transition-colors ${
                    i === symIdx ? "border-bull/60 bg-bull/10 text-bull" : "border-border text-fg-dim hover:border-fg-dim hover:text-fg"
                  }`}
                >
                  {s.sym}
                </button>
              ))}
            </div>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <label className="flex items-center gap-2 text-fg-faint">
              strikes
              <select
                value={chainDepth}
                onChange={(e) => setChainDepth(Number(e.target.value))}
                className="border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-dim outline-none focus:border-bull/50"
              >
                <option value={4}>±4</option>
                <option value={5}>±5</option>
                <option value={8}>±8</option>
              </select>
            </label>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            {/* days-from-now slider — drives the same `days` state as the cone drag + chain stepper */}
            <label className="flex shrink-0 items-center gap-2 text-fg-faint">
              days from now
              <input
                type="range"
                min={1}
                max={365}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-1 w-24 accent-bull xl:w-32"
                aria-label="days from now"
              />
              <span className="text-amber tabular-nums">
                {days}d<span className="lg:hidden"> · {expiryStr}</span>
              </span>
            </label>
            <button
              onClick={resetView}
              className="ml-auto shrink-0 border border-border px-2 py-0.5 text-fg-dim transition-colors hover:border-bull/50 hover:text-bull"
            >
              reset view ⟲
            </button>
          </div>

          {/* chart + draggable probability cone — ≈55% of the column on lg */}
          <section id="thesis" className="scroll-mt-16 border border-border bg-surface transition-shadow duration-500 hover:shadow-[0_0_60px_-18px_rgba(0,255,135,0.35)] lg:flex lg:min-h-0 lg:shrink-0 lg:grow-0 lg:basis-[55%] lg:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-soft px-3 py-2 lg:shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bull">⟢ forecast cone · {sym.sym}</span>
              <span className="hidden max-w-[62%] truncate font-mono text-[10px] text-fg-dim md:block">
                <ThesisLine sentence={thesisSentence} />
              </span>
            </div>
            <div className="relative h-[420px] bg-bg lg:h-auto lg:min-h-0 lg:flex-1">
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
                  bandProb={probInBand}
                />
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">loading forecast cone…</div>
              )}
              {/* in-band probability ring — same number the strategy panel prices from */}
              <div className="pointer-events-none absolute left-4 top-4 z-10 hidden sm:block">
                <InBandRing prob={probInBand} />
              </div>
            </div>
          </section>

          {/* options chain — fills the rest of the column; rows scroll internally,
              footer stays pinned at the bottom of the column */}
          <ChainTable
            symbol={sym.sym}
            spot={spot}
            iv={sym.iv}
            days={days}
            perSide={chainDepth}
            onStepDays={(d) => setDays(Math.max(1, Math.min(365, days + d)))}
          />
        </div>

        {/* ---- right rail: strategy · greeks · teacher · analytics — its own scroll ---- */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:gap-3 lg:overflow-y-auto">
          {/* strategy panel — picker + legs + payoff/stat rail + place CTA, all inside */}
          <section id="pick" className="scroll-mt-16 border border-border bg-surface lg:shrink-0">
            <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim">strategy · pick one of three</span>
              <Link
                href="/trade/chain"
                className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull/50 hover:text-bull"
              >
                edit legs ✎
              </Link>
            </div>
            <StrategyCards
              strategies={strategies}
              selectedId={selectedId}
              onSelect={(s) => setSelectedId(s.id)}
              onPlace={(s) => { setSelectedId(s.id); placeBet(s); }}
              spot={spot}
              symbol={sym.sym}
              columns={1}
              compact
            />
            {selected && <LegsList s={selected} />}
            {selected && (
              <StrategyDetail
                s={selected}
                symbol={sym.sym}
                spot={spot}
                prob={probInBand}
                onPlace={() => placeBet(selected)}
              />
            )}
          </section>

          {/* plain-english greeks */}
          <PlainGreeks s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} onDetails={() => { window.location.href = "/greeks"; }} />

          {/* AI teacher */}
          <TeacherPanel
            selected={selected}
            narrating={narrating}
            thread={thread}
            onExplain={() => selected && narrate(selected)}
            onAsk={(q) => selected && narrate(selected, q)}
          />

          {/* under the hood — one analytics panel at a time, compact rail edition */}
          <section id="detail" className="scroll-mt-16 border border-border bg-surface lg:shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-bg-soft px-2 py-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors ${
                    tab === t.id
                      ? "border-bull/60 bg-bull/10 text-bull"
                      : "border-border text-fg-dim hover:border-fg-dim hover:text-fg"
                  }`}
                >
                  {t.label}
                  {t.id === "manage" ? ` (${openCount})` : ""}
                </button>
              ))}
            </div>
            <div id="manage" className="scroll-mt-16">
              {tab === "whatif" && <TimeMachine s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} />}
              {tab === "events" && mounted && <EventTimeline events={events} daysToExpiry={days} baseDate={new Date()} />}
              {tab === "models" && mounted && <ModelSpread spot={spot} low={low} high={high} daysToExpiry={days} iv={sym.iv} />}
              {tab === "manage" && (
                <ManagePanel
                  bets={bets}
                  liveSpot={spot}
                  iv={sym.iv}
                  onClose={(id, pnl) =>
                    setBets((cur) => cur.map((b) => (b.id === id ? { ...b, status: "closed", closedPnl: pnl } : b)))
                  }
                  onRoll={() => alert("Roll preview — extending to next monthly expiry. Coming soon as a real flow.")}
                />
              )}
            </div>
          </section>
        </div>
      </div>
      </div>{/* /app shell */}

      {/* mobile: essentials + PLACE pinned to the bottom */}
      <BetBar prob={probInBand} selected={selected} onPlace={() => selected && placeBet(selected)} />

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
                      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{s.k}</div>
                      <div className={`mt-1 font-mono text-base tabular-nums ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button onClick={() => setConfirm(null)} className="border border-border bg-bg px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg lg:py-2">cancel</button>
                  <button onClick={confirmBet} className="bg-bull px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim lg:py-2">place this bet</button>
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
            ✓ bet placed · see the positions tab
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

/** Ring gauge overlaid on the chart — "N% IN BAND · PROBABILITY @ EXPIRATION". */
function InBandRing({ prob }: { prob: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, prob));
  const tone = prob > 0.6 ? "var(--bull)" : prob > 0.35 ? "var(--cyan)" : "var(--bear)";
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
          <circle cx="52" cy="52" r={r} stroke="var(--border)" strokeWidth="6" fill="rgba(5,5,5,0.55)" />
          <circle
            cx="52"
            cy="52"
            r={r}
            stroke={tone}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - c * p}
            transform="rotate(-90 52 52)"
            style={{
              filter: "drop-shadow(0 0 6px rgba(0,255,135,0.45))",
              transition: "stroke-dashoffset 0.5s cubic-bezier(.22,.68,.26,1), stroke 0.3s",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl leading-none tracking-tightest tabular-nums" style={{ color: tone }}>
            {Math.round(prob * 100)}%
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">in band</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        <span className="size-2 shrink-0 border border-bull/60 bg-bull/20" aria-hidden />
        <span className="leading-tight">probability<br />@ expiration</span>
      </div>
    </div>
  );
}

/** The selected strategy's legs, broker-ticket style: Buy/Sell qty strike type · mid. */
function LegsList({ s }: { s: Strategy }) {
  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between bg-bg-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        <span>legs · selected</span>
        <span>mid px</span>
      </div>
      <ul className="divide-y divide-border-soft">
        {s.legs.map((l, i) => (
          <li key={i} className="flex items-center justify-between px-3 py-2 font-mono text-[12px] tabular-nums">
            <span className={l.side === "long" ? "text-bull" : "text-bear"}>
              {l.side === "long" ? "Buy" : "Sell"} {l.qty} {l.strike} {l.type === "C" ? "CALL" : "PUT"}
            </span>
            <span className={l.side === "long" ? "text-fg" : "text-bear"}>
              {l.side === "long" ? "" : "−"}{l.premium.toFixed(2)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between bg-bg px-3 py-2 font-mono text-[12px] tabular-nums">
          <span className="text-fg">{s.cost > 0 ? "Net Debit" : "Net Credit"}</span>
          <span className="text-bull">{Math.abs(s.cost / 100).toFixed(2)}</span>
        </li>
      </ul>
    </div>
  );
}

/** Selected-strategy detail, ref-style: fact chips, payoff diagram beside a
 *  snug label/value stat rail, and the place-bet CTA — all inside the panel. */
function StrategyDetail({
  s,
  symbol,
  spot,
  prob,
  onPlace,
}: {
  s: Strategy;
  symbol: string;
  spot: number;
  prob: number;
  onPlace: () => void;
}) {
  const tone = STRATEGY_TONE[s.id];
  // NaN is not Infinity: `Number.isFinite(NaN)` is false and `NaN > 0` is false,
  // so a failed computation used to print the confident-sounding "unbounded".
  // Show an em-dash instead — never dress a broken number as a risk statement.
  const fmt = (n: number) =>
    Number.isNaN(n)
      ? "—"
      : Number.isFinite(n)
        ? `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`
        : n > 0
          ? "uncapped"
          : "unbounded";
  const definedRisk = Number.isFinite(s.maxLoss);
  const chips: string[] = [
    ...(Number.isFinite(s.cost) ? [s.cost > 0 ? "debit" : "credit"] : []),
    s.bias,
    ...(definedRisk ? ["defined risk"] : []),
  ];
  const rr =
    Number.isFinite(s.maxProfit) && definedRisk && Math.abs(s.maxLoss) > 0 ? s.maxProfit / Math.abs(s.maxLoss) : null;
  const rail: { k: string; v: string; c: string }[] = [
    { k: "max profit", v: fmt(s.maxProfit), c: "text-bull" },
    { k: "max loss", v: fmt(s.maxLoss), c: "text-bear" },
    ...(s.breakevens.length
      ? [{ k: "breakeven", v: s.breakevens.map((b) => b.toFixed(2)).join(" / "), c: "text-fg" }]
      : []),
    { k: "pop", v: `${(s.prob * 100).toFixed(0)}%`, c: "text-bull" },
    ...(rr != null ? [{ k: "r:r", v: rr.toFixed(2), c: "text-fg" }] : []),
  ];

  return (
    <div className="border-t border-border p-3">
      {/* fact chips — derived from the strategy, never invented */}
      <div className="flex flex-wrap items-center gap-1">
        {chips.map((c, i) => (
          <span
            key={c}
            className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              i === 0 ? "border-bull/60 text-bull" : "border-border text-fg-dim"
            }`}
          >
            {c}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-fg-faint tabular-nums">
          {s.cost > 0 ? "you pay" : "you collect"} ${Math.abs(s.cost).toFixed(0)}
        </span>
      </div>

      {/* payoff diagram | snug stat rail */}
      <div className="mt-3 flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <PnlSparkline s={s} spot={spot} className="w-full min-h-16 flex-1" />
          <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
            p/l @ expiration
          </div>
        </div>
        <div className="grid w-[200px] shrink-0 grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5">
          {rail.map((it) => (
            <div key={it.k} className="contents">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{it.k}</span>
              <span className={`text-right font-mono text-[12px] tabular-nums ${it.c}`}>{it.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* place CTA — bordered, inside the panel, tone-coloured like the cards */}
      <button
        type="button"
        onClick={onPlace}
        className="mt-3 flex w-full items-center justify-between border px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-85 lg:py-2.5"
        style={{ borderColor: tone.color, color: tone.color, background: tone.pillBg }}
      >
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full pulse-dot" style={{ background: tone.color }} />
          place this bet on {symbol}
        </span>
        <span>→</span>
      </button>
      <div className="mt-1.5 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        {Math.round(prob * 100)}% in band · black-scholes · paper only
      </div>
    </div>
  );
}

/** AI teacher panel: explanation thread + "ask anything" input. Answers come
 *  from the same /api/explain flow the explain button uses — it describes the
 *  position the user built; it never gives advice. */
function TeacherPanel({
  selected,
  narrating,
  thread,
  onExplain,
  onAsk,
}: {
  selected: Strategy | null;
  narrating: boolean;
  thread: { role: "user" | "teacher"; text: string }[];
  onExplain: () => void;
  onAsk: (q: string) => void;
}) {
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, narrating]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || !selected || narrating) return;
    setQ("");
    onAsk(text);
  };

  return (
    <section className="flex flex-col border border-border bg-surface lg:shrink-0">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim">
          ai teacher
          <span className="border border-bull/40 bg-bull/10 px-1 py-px font-mono text-[10px] uppercase tracking-[0.2em] text-bull">beta</span>
        </span>
        <button
          type="button"
          onClick={onExplain}
          disabled={!selected || narrating}
          className="border border-bull/40 bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bull transition-colors hover:bg-bull/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          explain this position
        </button>
      </div>

      <div className="flex max-h-[300px] min-h-[160px] flex-col gap-3 overflow-y-auto p-3 lg:max-h-[240px] lg:min-h-[120px]">
        {thread.length === 0 && !narrating && (
          <TeacherBubble
            speaker="teacher"
            text={
              selected
                ? `This panel describes the ${selected.kind} you built — max profit, max loss, breakevens, and what can go wrong. Press "explain this position", or type a question below.`
                : "Pick a strategy on the left to get a plain-English read of the position."
            }
          />
        )}
        {thread.map((m, i) => (
          <TeacherBubble key={i} speaker={m.role} text={m.text} />
        ))}
        {narrating && <TeacherBubble speaker="teacher" text="teacher is thinking…" thinking />}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-bg-soft p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about this trade..."
          disabled={!selected}
          className="min-w-0 flex-1 border border-border bg-bg px-3 py-2 font-mono text-[12px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-bull/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!selected || narrating || !q.trim()}
          aria-label="ask the teacher"
          className="flex size-9 shrink-0 items-center justify-center bg-bull text-bg transition-colors hover:bg-bull-dim disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </form>
      <div className="border-t border-border-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        describes the position you built · education, not advice
      </div>
    </section>
  );
}

// `speaker` (not `role`) so a JSX `speaker="teacher"` can never be misread as a
// DOM ARIA role — it styles the chat bubble, it is never a DOM attribute.
function TeacherBubble({ speaker, text, thinking }: { speaker: "user" | "teacher"; text: string; thinking?: boolean }) {
  if (speaker === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] border border-border bg-bg-soft px-3 py-2 text-[12px] leading-relaxed text-fg">{text}</div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className="flex size-8 shrink-0 select-none items-center justify-center border border-bull/40 bg-bg font-mono text-[12px] text-bull" aria-hidden>
        :]
      </span>
      <div
        className={`relative max-w-[85%] whitespace-pre-line border border-bull/40 bg-surface px-3 py-2 leading-relaxed ${
          thinking ? "font-mono text-[11px] text-fg-faint" : "text-[12px] text-fg"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
