"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ProbabilityCone } from "@/components/wedge/ProbabilityCone";
import { PlainGreeks } from "@/components/wedge/PlainGreeks";
import { TimeMachine } from "@/components/wedge/TimeMachine";
import { EventTimeline } from "@/components/wedge/EventTimeline";
import { ModelSpread } from "@/components/wedge/ModelSpread";
import { ManagePanel } from "@/components/wedge/ManagePanel";
import { ChainTable } from "@/components/wedge/ChainTable";
import { BetBar } from "@/components/wedge/BetSlip";
import { PayoffChart, StrategyChoices, familyName, howItPays } from "@/components/wedge/BuilderParts";
import { storySentence, type Bet } from "@/components/wedge/PositionStory";
import { bullCallSpread, generateStrategies, probBS, type Strategy } from "@/lib/models";
import { useChosenPosition } from "@/lib/hero-position";
import { DAYS as SIM_DAYS, IV as SIM_IV, SPOT as SIM_SPOT } from "@/lib/hero-spread";
import { optionOpenRefusal, usePaper, useSafety } from "@/lib/stores";
import { useModalFocus } from "@/components/safety/useModalFocus";
import { RegulatoryLine } from "@/components/RegulatoryLine";
import { RiskWizard } from "@/components/safety/RiskWizard";
import { withBriefing } from "@/lib/safety-briefing";
import { TAPE } from "@/lib/viz/tape";
import { scheduledEvents } from "@/lib/events";
import { UpgradeNudge } from "@/components/billing/UpgradeNudge";
import { isPaywall, type PaywallBody } from "@/lib/billing/gate";
import { decodeLegs, shareUrl, type SharedTrade, type SharedTradeInput } from "@/lib/share-trade";
import { detect } from "@/lib/detector";
import { pnlSummary, type Leg } from "@/lib/pricing";
import { noteBuilderAbandon, noteExplainRequest, tradeFingerprint } from "@/lib/confusion";
import { flushEvents, track } from "@/lib/track";
import { clearIsland, setIsland } from "@/lib/island";
import { TruthBadge } from "@/components/pro/TruthBadge";
import { Sparkles } from "lucide-react";
import { TogglePill } from "@/components/calm/kit";

// IV is still synthetic (no free options-IV feed); spot is now live.
// The fallback prices are the one synthetic tape every page shares (lib/viz/tape.ts).
const SYMBOLS = TAPE.filter((t) => t.sym !== "MSFT").map((t) => ({ ...t }));
const SYM_LIST = SYMBOLS.map((s) => s.sym).join(",");
// The home page's synthetic index. Listed only for a visitor who brought a
// spread from there. It has no quote or history to fetch and no earnings, and
// a position on it cannot be placed: paper trades fill at real prices.
const SIM = { sym: "SIM", name: "Synthetic index", spot: SIM_SPOT, iv: SIM_IV };
const SIM_NOTE = "SIM is a practice index with no real price to fill at. Pick a real underlying to place a paper trade.";

type LiveQuote = { last: number; chg: number; chgPct: number; name?: string; exch?: string };

function dateNDaysOut(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

// The "Go deeper" panels, one at a time (progressive disclosure).
const TABS = [
  { id: "whatif", label: "What-if machine" },
  { id: "greeks", label: "Greeks" },
  { id: "events", label: "Event horizon" },
  { id: "models", label: "Model spread" },
  { id: "manage", label: "Positions" },
  { id: "chain", label: "Options chain" },
] as const;
type TabId = (typeof TABS)[number]["id"];


/**
 * The strategy builder. Rendered by app/trade/page.tsx, which is a server component
 * only so that `?t=` can reach generateMetadata — see the note there.
 *
 * @param sharedParam the raw `t=` value, straight off the URL. Untrusted:
 *   decodeLegs() is the only thing allowed to interpret it.
 */
export function TradeWorkbench({ sharedParam }: { sharedParam?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A shared trade, if this page was opened from a copied link. Decoded once,
  // client and server identically (pure function of the prop), so the initial
  // symbol below can be chosen during the first render without a flash.
  const shared: SharedTrade | null = useMemo(() => decodeLegs(sharedParam), [sharedParam]);
  // Where the shared underlying sits in SYMBOLS, or -1 when the link names one
  // this page does not carry (a /trade/chain symbol, say). -1 means the shared
  // position is still SHOWN, it just does not drive the chart.
  const sharedIdx = shared ? SYMBOLS.findIndex((s) => s.sym === shared.underlying) : -1;

  // THE VISITOR'S SPREAD, BROUGHT FROM THE HOME PAGE (Gate A4 #6). "Open the
  // builder" used to land on an empty page, whatever they had just shaped. A
  // shared link outranks it: that link is what the visitor came here to see.
  const chosen = useChosenPosition();
  const brought = shared ? null : chosen;
  const symbols = useMemo(() => (brought ? [SIM, ...SYMBOLS] : SYMBOLS), [brought]);

  const [symId, setSymId] = useState(() => SYMBOLS[sharedIdx >= 0 ? sharedIdx : 0].sym);
  const sym = symbols.find((s) => s.sym === symId) ?? SYMBOLS[0];
  const isSim = sym === SIM;

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
      // SIM has no history to fetch; it takes the deterministic walk below.
      if (sym !== SIM) {
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
      // Scaled to end at the spot. Snapping only the last bar to it printed a
      // one-day move of up to 10% that never happened in the header.
      const toSpot = sym.spot / out[out.length - 1].c;
      setHistBars(out.map((b) => ({ ...b, c: b.c * toSpot })));
    })();
    return () => { cancelled = true; };
  }, [sym]);

  // Change readout: real quote change when available, else derived from the
  // last two historical closes.
  const prevClose = histBars.length > 1 ? histBars[histBars.length - 2].c : spot;
  const chg = quote?.chg ?? spot - prevClose;
  const chgPct = quote?.chgPct ?? (prevClose ? ((spot - prevClose) / prevClose) * 100 : 0);

  // The band a shared trade implies: its own strikes, with a little air. Null
  // unless the link names a symbol this page can chart.
  const sharedBand = useMemo(() => {
    if (!shared || sharedIdx < 0) return null;
    const ks = shared.legs.map((l) => l.strike);
    return {
      low: Math.min(...ks) * 0.98,
      high: Math.max(...ks) * 1.02,
      days: shared.daysToExpiry,
    };
  }, [shared, sharedIdx]);

  // thesis
  const [low, setLow] = useState(sharedBand?.low ?? sym.spot * 0.95);
  const [high, setHigh] = useState(sharedBand?.high ?? sym.spot * 1.06);
  const [days, setDays] = useState(sharedBand?.days ?? 35);
  // Until the visitor drags the band, the range is ours, not theirs, so the
  // header must not put a forecast in their mouth ("I think AMZN will…" used to
  // render on first paint). A shared link carries a range a person chose.
  const [touched, setTouched] = useState(Boolean(sharedBand));

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
    // A SHARED TRADE OWNS THE BAND AND THE EXPIRY for its own underlying. The
    // whole point of the link is that the receiver sees the position that was
    // sent, so the live-quote re-anchor above must not reset it out from under
    // them a second after it loads. "reset view ⟲" still returns to default.
    if (sharedBand && sym.sym === shared?.underlying) {
      setLow(sharedBand.low);
      setHigh(sharedBand.high);
      setDays(sharedBand.days);
      return;
    }
    // So does a brought spread, on SIM: the band is the visitor's two strikes.
    if (isSim && brought) {
      setLow(brought.k1);
      setHigh(brought.k2);
      setDays(SIM_DAYS);
      return;
    }
    setLow(spot * 0.95);
    setHigh(spot * 1.06);
    setDays(35);
  }, [sym.sym, quote, spot, shared, sharedBand, isSim, brought]);

  const resetView = () => {
    if (isSim && brought) {
      setLow(brought.k1);
      setHigh(brought.k2);
      setDays(SIM_DAYS);
      return;
    }
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
  // NOTHING IS PRESELECTED. This used to open on the "income" iron condor,
  // so the first thing /trade put in front of a newcomer was a ready-made
  // position on a real ticker with a "place this trade on AMZN" button under
  // it: a proposal, from a product whose compliance line is that it never
  // proposes one (docs/COMPLIANCE.md; re-tribunal #1). The examples are listed;
  // a position exists once the visitor picks or builds one.
  const [selectedId, setSelectedId] = useState<Strategy["id"] | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // The chain's pointer, shared with the cone. Deliberately NOT persisted or
  // debounced: it is a cursor, and a cursor that lags its pointer reads broken.
  const [hoverStrike, setHoverStrike] = useState<number | null>(null);
  const broughtStrategy = useMemo(
    () => (brought && isSim ? bullCallSpread({ spot, k1: brought.k1, k2: brought.k2, daysToExpiry: days, iv: sym.iv }) : null),
    [brought, isSim, spot, days, sym.iv]
  );
  const selected = selectedId === "brought" ? broughtStrategy : (strategies.find((s) => s.id === selectedId) ?? null);

  // Open on the brought spread, once, and before the first paint so a visitor
  // arriving from the home page never sees the empty builder flash by. Its
  // being set here is what lets the page still render the same on the server.
  const broughtOpened = useRef(false);
  useLayoutEffect(() => {
    if (!brought || broughtOpened.current) return;
    broughtOpened.current = true;
    setSymId(SIM.sym);
    setLow(brought.k1);
    setHigh(brought.k2);
    setDays(SIM_DAYS);
    setTouched(true);
    setSelectedId("brought");
  }, [brought]);

  const pickSymbol = (next: string) => {
    setSymId(next);
    if (next === SIM.sym) setSelectedId("brought");
    else if (selectedId === "brought") setSelectedId(null);
  };

  // The Island (M32): the position being built, while there is one. The arc
  // is the weeks to expiry with this week lit; the number is the floor.
  useEffect(() => {
    if (!selected) {
      clearIsland("trade-build");
      return;
    }
    const defined = Number.isFinite(selected.maxLoss);
    const floor = `−$${Math.abs(selected.maxLoss).toFixed(0)}`;
    setIsland({
      id: "trade-build",
      label: `${selected.kind} · paper`,
      value: defined ? floor : "No floor",
      caption: `${defined ? "the most it can lose" : "the loss is unbounded"} · ${sym.sym}, ${days} days to expiry`,
      segments: Math.max(2, Math.min(10, Math.ceil(days / 7))),
      active: 0,
      glyph: "clock",
      announce: `${selected.kind} on ${sym.sym}, on paper: ${defined ? `the most it can lose is ${floor}` : "the loss has no floor"}.`,
    });
  }, [selected, days, sym.sym]);
  useEffect(() => () => clearIsland("trade-build"), []);

  // events
  const events = useMemo(() => {
    if (sym === SIM) return [];
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    // Published dates only (lib/events.ts): the same for every stock.
    return scheduledEvents(start, end);
  }, [sym, days]);

  // bets / positions. The paper ACCOUNT is the store's; `bets` below is only
  // this page's richer view of the same trades (thesis band, expiry, story).
  const openPaperPosition = usePaper((s) => s.open);
  // Subscribed so a refusal (training wheels, kill switch) updates the moment
  // either changes; optionOpenRefusal reads the store itself.
  const wheelsOn = useSafety((s) => s.trainingWheels);
  const halted = useSafety((s) => s.killSwitchTriggered);
  const [bets, setBets] = useState<Bet[]>([]);
  const [confirm, setConfirm] = useState<Bet | null>(null);
  // Only ever read for truthiness (the toast below) — a Bet satisfies it, and
  // so does the shared-trade path, which books straight into the paper store.
  const [recentlyPlaced, setRecentlyPlaced] = useState<{ id: string } | null>(null);
  const openCount = bets.filter((b) => b.status === "open").length;

  // ── the abandon half of the confusion heuristic (lib/confusion.ts) ────────
  // A builder session that ran longer than 30 seconds and ended with no paper
  // trade. Ends on unmount OR pagehide, whichever comes first, exactly once.
  const builderStartedRef = useRef(0);
  const placedRef = useRef(false);
  const endedRef = useRef(false);
  useEffect(() => {
    builderStartedRef.current = Date.now();
    // Reset per mount: React's dev StrictMode mounts, unmounts and remounts,
    // and a latched `ended` from that throwaway first pass would silence the
    // real session's signal.
    endedRef.current = false;
    const end = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      // track()'s own pagehide listener was registered first (the layout's
      // Tracker fires a page_view before this page mounts), so by the time we
      // queue this the batch has already been beaconed — flush again or the
      // signal dies in the queue.
      if (noteBuilderAbandon(builderStartedRef.current, placedRef.current)) flushEvents(true);
    };
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
  }, []);

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
    // A stranger's first paper trade gets the risk briefing first.
    withBriefing(() => setConfirm(b));
  };
  const confirmLegs = useMemo<Leg[]>(
    () =>
      confirm
        ? confirm.strategy.legs.map((l, i) => ({
            id: `${confirm.id}-leg-${i}`,
            type: l.type,
            side: l.side,
            strike: l.strike,
            qty: l.qty,
            premium: l.premium,
          }))
        : [],
    [confirm]
  );
  const confirmRefusal = useMemo(
    () => (confirm ? optionOpenRefusal(confirmLegs, confirm.spotAtOpen) : null),
    // wheelsOn/halted: re-ask when the safety store changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirm, confirmLegs, wheelsOn, halted]
  );
  const confirmRef = useRef<HTMLDivElement>(null);
  useModalFocus(confirmRef, !!confirm, { onEscape: () => setConfirm(null) });
  const confirmBet = () => {
    if (!confirm) return;
    // WRITE THROUGH TO THE REAL PAPER ACCOUNT.
    //
    // This page used to keep positions in local state alone, so its "placed"
    // toast was a lie: nothing reached the paper store, nothing showed up in
    // /portfolio, and a reload erased the position. /trade/chain has always
    // written to the store via the same open() below — two parallel position
    // systems, and the primary CTA pointed at the one that forgot.
    //
    // The store owns the money; local `bets` stays only as this page's own
    // view of the position (its story/manage panels read the Bet shape).
    // The store refuses what the safety settings forbid; the modal already
    // shows why, so a refusal just leaves it open.
    const pos = openPaperPosition({
      underlying: confirm.symbol,
      strategy: confirm.strategy.kind,
      openSpot: confirm.spotAtOpen,
      cost: confirm.cost,
      legs: confirmLegs,
    });
    if (!pos) return;
    setBets((cur) => [confirm, ...cur]);
    placedRef.current = true; // this session ended in a trade — not an abandon
    setRecentlyPlaced(confirm);
    setConfirm(null);
    setTimeout(() => setRecentlyPlaced(null), 3500);
  };

  // ── the shared trade, rebuilt ────────────────────────────────────────────
  // A link's position is booked STRAIGHT into the paper store: it is not one
  // of the three generated cards, so it has no Strategy["id"] to hang on the
  // picker, and inventing one would put a stranger's legs in a slot the
  // generator owns. Same store, same ledger row, same $5k account.
  const sharedSpot = shared ? (sym.sym === shared.underlying ? spot : shared.spot) : 0;
  const [sharedPlaced, setSharedPlaced] = useState(false);
  const sharedRefusal = useMemo(
    () => (shared ? optionOpenRefusal(shared.legs, sharedSpot) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shared, sharedSpot, wheelsOn, halted]
  );
  const placeShared = () => {
    if (!shared || sharedPlaced) return;
    const d = detect(shared.legs);
    const cost = shared.legs.reduce(
      (sum, l) => sum + (l.side === "long" ? 1 : -1) * l.premium * l.qty * 100,
      0
    );
    const pos = openPaperPosition({
      underlying: shared.underlying,
      strategy: d.kind,
      openSpot: sharedSpot,
      cost,
      legs: shared.legs,
    });
    if (!pos) return;
    placedRef.current = true;
    setSharedPlaced(true);
    setRecentlyPlaced({ id: "shared" });
    setTimeout(() => setRecentlyPlaced(null), 3500);
    track("shared_trade_placed", { underlying: shared.underlying, legs: shared.legs.length });
  };

  // under-the-hood tabs
  const [tab, setTab] = useState<TabId>("whatif");

  const expiryStr = fmtDate(dateNDaysOut(days));

  // narrate via /api/explain (LLM only narrates, never predicts probabilities).
  // The endpoint takes a fixed position payload — questions from the teacher
  // input re-run the same explanation flow for the current position.
  const [narrating, setNarrating] = useState(false);
  const [thread, setThread] = useState<{ role: "user" | "teacher"; text: string }[]>([]);
  // The daily cap (app/api/explain answers 402 with lib/billing/gate.ts's
  // body) and the AI-output disclosure every answer carries — the panel
  // renders both; neither is assumed client-side.
  const [paywall, setPaywall] = useState<PaywallBody | null>(null);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const narrate = async (s: Strategy, question?: string) => {
    // The re-ask half of the confusion heuristic: the SAME position explained
    // twice inside five minutes. Only the explain button counts — a typed
    // follow-up is a conversation, not a repeat, and counting it would teach
    // the teacher to re-explain things people had already understood.
    if (!question) {
      noteExplainRequest(tradeFingerprint({ strategy: s.kind, underlying: sym.sym, legs: s.legs }));
    }
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
      if (isPaywall(r.status, j)) {
        setPaywall(j);
        return;
      }
      setPaywall(null);
      if (typeof j.disclosure === "string") setDisclosure(j.disclosure);
      if (j.text) setThread((cur) => [...cur, { role: "teacher", text: j.text }]);
    } finally {
      setNarrating(false);
    }
  };

  // The examples to choose from: the visitor's own spread first when they
  // brought one from the home page, then the three the generator built.
  const choices = isSim && broughtStrategy ? [broughtStrategy, ...strategies] : strategies;

  // Choosing an example brings its review into view, but only when the review
  // is below the fold: a visitor comparing the cards is not yanked around.
  const choose = (s: Strategy) => {
    setSelectedId(s.id);
    requestAnimationFrame(() => {
      const el = document.getElementById("review");
      if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.8) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  };

  // "on Dec 22" once the browser's clock is known; "at expiry" before (the
  // server's date is not the reader's — Gate A4 #2).
  const when = mounted ? `on ${expiryStr}` : "at expiry";

  return (
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg pb-20 text-fg lg:pb-0">
      <ScrollProgress />
      <Nav wide />

      {/* THE GUIDED BUILDER (owner, 2026-11-17: "simple to understand, gives
          the output in a good way"). Four numbered steps, one question each —
          pick a stock, show where you think it ends up, pick a way to trade
          it, review and place — with every answer in words beside its numbers
          and risk shown first (the deck's terminal rule, slides 8 and 17). The
          analysis tools and the chain sit in one "Go deeper" section. */}
      <div className="shell shell-wide flex flex-col gap-12 pb-12 pt-8 lg:gap-14 lg:pt-12">
        <header className="max-w-[46rem]">
          <p className="deck-eyebrow">Strategy builder</p>
          <h1 className="deck-h2 mt-4 text-fg">
            Turn your view into a trade <span className="deck-accent">you can see</span>
          </h1>
          <p className="deck-lede mt-4">
            Pick a stock, show where you think it ends up, and compare three ways to trade that view. What you could
            lose is always shown first, and everything here is paper money.
          </p>
        </header>

        {/* a shared trade, rebuilt — only when ?t= decoded */}
        {shared && (
          <SharedTradePanel
            trade={shared}
            spot={sharedSpot}
            placed={sharedPlaced}
            refusal={sharedRefusal}
            onPlace={placeShared}
          />
        )}

        <Step n="01" title="Pick a stock">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div role="group" aria-label="Underlying" className="flex flex-wrap gap-2">
              {symbols.map((s) => (
                <TogglePill
                  key={s.sym}
                  on={s.sym === sym.sym}
                  onClick={() => pickSymbol(s.sym)}
                  className="!h-10 !px-4 !font-mono !text-[0.8125rem] !tracking-[0.04em]"
                >
                  {s.sym}
                </TogglePill>
              ))}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[1rem] text-fg-dim">{quote?.name ?? sym.name}</span>
              <span className="deck-figure text-[clamp(2.1rem,3.4vw,2.75rem)] text-fg">${spot.toFixed(2)}</span>
              <span className={`t-data text-[0.9375rem] ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                {chg >= 0 ? "+" : "−"}{Math.abs(chg).toFixed(2)} ({chg >= 0 ? "+" : "−"}{Math.abs(chgPct).toFixed(2)}%)
              </span>
            </div>
          </div>
          {/* Every provenance claim on one quiet line: what the price is, that
              the chain and the volatility are modelled, and that this is paper. */}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-fg-faint">
            <span aria-hidden className={`size-1.5 rounded-full ${quote ? "bg-bull" : "bg-fg-faint"}`} />
            <span>
              {isSim
                ? "Synthetic index · not a real security"
                : quote
                  ? `Live price · ${quote.exch ?? "US market"}`
                  : "Seed price · connecting"}
            </span>
            <span aria-hidden>·</span>
            <TruthBadge quiet />
            <span aria-hidden>·</span>
            <span>Illustrative volatility {(sym.iv * 100).toFixed(0)}%</span>
            <span aria-hidden>·</span>
            <span>Paper only · $5k practice account</span>
          </p>
        </Step>

        <Step id="thesis" n="02" title={`Where do you think ${sym.sym} ends up?`}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col">
              {/* chart + draggable probability cone */}
              <div className="deck-pane relative min-h-[25rem] flex-1 overflow-hidden">
                <div className="absolute inset-0 p-2">
                  {mounted ? (
                    <ProbabilityCone
                      bars={histBars}
                      spot={spot}
                      iv={sym.iv}
                      daysToExpiry={days}
                      low={low}
                      high={high}
                      onChangeLow={(v) => { setLow(v); setTouched(true); }}
                      onChangeHigh={(v) => { setHigh(v); setTouched(true); }}
                      onChangeDays={(v) => { setDays(v); setTouched(true); }}
                      events={events}
                      bandProb={probInBand}
                      // The implied range and the position share one price ruler.
                      legs={selected?.legs}
                      breakevens={selected?.breakevens}
                      hoverStrike={hoverStrike}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[0.8125rem] text-fg-faint">Loading the chart…</div>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-fg-faint">
                <span className="text-fg-dim">How to read it:</span> the line is {sym.sym}&rsquo;s last 60 days, the shaded
                cone is where the model expects the price could go, and the green band is your range. Drag the band, or
                type Hi and Lo above the chart.
              </p>
            </div>

            {/* the readout: the band in words, its odds, and the date */}
            <aside aria-label="Your range" className="deck-pane flex flex-col p-5">
              <div className="deck-label">{touched ? "Your range" : "Starting range"}</div>
              <p className="mt-2 text-[1.125rem] leading-snug text-fg">
                {sym.sym} ends between <span className="t-data">${low.toFixed(2)}</span> and{" "}
                <span className="t-data">${high.toFixed(2)}</span> {mounted ? `by ${expiryStr}` : `in ${days} days`}
              </p>
              {!touched && (
                <p className="mt-1.5 text-[0.8125rem] text-fg-faint">A starting point. Drag the band to make it yours.</p>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[0.8125rem] text-fg-faint">Chance it ends in this range</div>
                <div className="deck-figure mt-1 text-[3.25rem] text-fg">{Math.round(probInBand * 100)}%</div>
                <p className="mt-1 text-[0.75rem] leading-snug text-fg-faint">
                  Black-Scholes model, illustrative volatility. A model, not a forecast.
                </p>
              </div>

              {/* days-from-now slider — drives the same `days` state as the cone drag + chain stepper */}
              <label className="mt-5 block border-t border-border pt-4">
                <span className="flex items-baseline justify-between gap-3 text-[0.8125rem] text-fg-faint">
                  <span>By when?</span>
                  <span className="t-data text-fg">
                    {days} days{mounted && <span className="text-fg-faint"> · {expiryStr}</span>}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={365}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-2 w-full py-2 accent-bull"
                  aria-label="Days to expiry"
                  aria-valuetext={mounted ? `${days} days, ${expiryStr}` : `${days} days`}
                />
              </label>

              <div className="mt-auto flex justify-end pt-4">
                <button type="button" onClick={resetView} className="deck-btn deck-btn-sm">
                  Reset the range
                </button>
              </div>
            </aside>
          </div>
        </Step>

        <Step
          id="pick"
          n="03"
          title="Pick a way to trade it"
          hint={`Three common ways to trade a view on ${sym.sym}. Each one shows the most you could lose first, then the most you could make.`}
        >
          <StrategyChoices strategies={choices} selectedId={selectedId} onSelect={choose} spot={spot} />
        </Step>

        <Step id="review" n="04" title="Review and place">
          {!selected ? (
            <p className="rounded-[14px] border border-dashed border-[var(--deck-rule)] px-5 py-8 text-center text-[0.9375rem] text-fg-faint">
              Choose one of the ways above to see exactly how it pays, what you could lose and what you could make.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="deck-pane p-5">
                <PayoffChart s={selected} spot={spot} symbol={sym.sym} />
              </div>

              <div className="deck-pane flex flex-col p-5">
                <h3 className="deck-display text-[1.75rem] leading-tight tracking-[-0.02em] text-fg">
                  {familyName(selected.kind)} <span className="text-fg-dim">on {sym.sym}</span>
                </h3>
                <p className="mt-3 text-[1.0625rem] leading-relaxed text-fg">{howItPays(selected, sym.sym, when)}</p>
                <p className="mt-1 text-[0.9375rem] text-fg-dim">
                  {selected.cost > 0
                    ? `You pay $${selected.cost.toFixed(0)} to open it.`
                    : `You get $${Math.abs(selected.cost).toFixed(0)} when you open it.`}
                </p>

                {/* Risk first: the loss is read before the gain. */}
                <dl className="mt-5 grid grid-cols-2 border-y border-border">
                  <div className="py-3 pr-3">
                    <dt className="text-[0.75rem] text-fg-faint">Most you can lose</dt>
                    <dd className="mt-1 t-data text-[1.25rem] text-bear">
                      {Number.isNaN(selected.maxLoss) ? "—" : Number.isFinite(selected.maxLoss) ? `$${Math.abs(selected.maxLoss).toFixed(0)}` : "No limit"}
                    </dd>
                  </div>
                  <div className="border-l border-border py-3 pl-4">
                    <dt className="text-[0.75rem] text-fg-faint">Most you can make</dt>
                    <dd className="mt-1 t-data text-[1.25rem] text-bull">
                      {Number.isNaN(selected.maxProfit) ? "—" : Number.isFinite(selected.maxProfit) ? `$${Math.abs(selected.maxProfit).toFixed(0)}` : "No cap"}
                    </dd>
                  </div>
                  <div className="border-t border-border py-3 pr-3">
                    <dt className="text-[0.75rem] text-fg-faint">Chance of profit</dt>
                    <dd className="mt-1 t-data text-[1.25rem] text-fg">{(selected.prob * 100).toFixed(0)}%</dd>
                  </div>
                  <div className="border-l border-t border-border py-3 pl-4">
                    <dt className="text-[0.75rem] text-fg-faint">{selected.breakevens.length > 1 ? "Breakevens" : "Breakeven"}</dt>
                    <dd className="mt-1 t-data text-[1.0625rem] text-fg">
                      {selected.breakevens.length ? selected.breakevens.map((b) => `$${b.toFixed(2)}`).join(" · ") : "—"}
                    </dd>
                  </div>
                </dl>

                {/* place CTA — the page's one main action */}
                {isSim ? (
                  <p className="mt-5 text-[0.875rem] leading-relaxed text-fg-dim">{SIM_NOTE}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => placeBet(selected)}
                    className="deck-btn deck-btn-primary mt-5 h-auto min-h-11 w-full whitespace-normal py-2.5 text-center leading-snug"
                  >
                    Place this paper trade
                    <span aria-hidden className="deck-arrow">
                      →
                    </span>
                  </button>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <CopyLinkButton trade={{ underlying: sym.sym, spot, daysToExpiry: days, legs: selected.legs }} />
                  <span className="text-[0.75rem] text-fg-faint">Paper only · not advice</span>
                </div>
                <TeacherPanel
                  selected={selected}
                  narrating={narrating}
                  thread={thread}
                  paywall={paywall}
                  disclosure={disclosure}
                  onDismissPaywall={() => setPaywall(null)}
                  onExplain={() => narrate(selected)}
                  onAsk={(q) => narrate(selected, q)}
                />
              </div>
            </div>
          )}
        </Step>

        {/* Everything else, one click away and out of the way. */}
        <section id="detail" aria-labelledby="deeper-title" className="scroll-mt-20 border-t border-[var(--deck-rule)] pt-6">
          <button
            type="button"
            aria-expanded={showAnalysis}
            aria-controls="deeper"
            onClick={() => setShowAnalysis((v) => !v)}
            className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
          >
            <span className="min-w-0">
              <span id="deeper-title" className="deck-h3 block text-[clamp(1.375rem,2.2vw,1.75rem)] text-fg">
                Go deeper
              </span>
              <span className="mt-1 block text-[0.9375rem] leading-relaxed text-fg-dim">
                What-if scenarios, the Greeks, upcoming events, model comparison, your positions
                {openCount > 0 ? ` (${openCount} open)` : ""} and the full options chain.
              </span>
            </span>
            <span className="deck-btn deck-btn-sm shrink-0">
              {showAnalysis ? "Hide" : "Show"}
              <span aria-hidden>{showAnalysis ? "↑" : "↓"}</span>
            </span>
          </button>

          {showAnalysis && (
            <div id="deeper" className="deck-pane mt-5 overflow-hidden">
              <div className="flex items-center gap-6 overflow-x-auto overflow-y-hidden border-b border-border px-5 pb-px">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className="deck-tab shrink-0"
                  >
                    {t.label}
                    {t.id === "manage" ? ` (${openCount})` : ""}
                  </button>
                ))}
              </div>
              <div id="manage" className="scroll-mt-20">
                {tab === "whatif" && <TimeMachine s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} />}
                {tab === "greeks" && (
                  <PlainGreeks s={selected} spot={spot} daysToExpiry={days} iv={sym.iv} onDetails={() => { window.location.href = "/greeks"; }} />
                )}
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
                {tab === "chain" && (
                  <div className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 text-[0.8125rem] text-fg-faint">
                        Strikes each side
                        <select
                          value={chainDepth}
                          onChange={(e) => setChainDepth(Number(e.target.value))}
                          className="calm-input !h-8 !px-2.5 t-data !text-[0.75rem]"
                        >
                          <option value={4}>±4</option>
                          <option value={5}>±5</option>
                          <option value={8}>±8</option>
                        </select>
                      </label>
                      <Link href="/trade/chain" className="deck-link text-[0.875rem]">
                        Build legs on the full visual chain
                        <span aria-hidden className="deck-arrow">
                          →
                        </span>
                      </Link>
                    </div>
                    <ChainTable
                      symbol={sym.sym}
                      spot={spot}
                      iv={sym.iv}
                      days={days}
                      perSide={chainDepth}
                      onStepDays={(d) => setDays(Math.max(1, Math.min(365, days + d)))}
                      onHoverStrike={setHoverStrike}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <RegulatoryLine className="shell shell-wide py-4" />

      {/* mobile: essentials + PLACE pinned to the bottom */}
      <BetBar
        prob={probInBand}
        selected={isSim ? null : selected}
        onPlace={() => selected && placeBet(selected)}
        hint={isSim ? "Practice index · pick a real underlying to place" : undefined}
      />

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirm(null)}
            className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              ref={confirmRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-trade-title"
              tabIndex={-1}
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="deck-pane w-full max-w-xl overflow-hidden shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] outline-none"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
                <span className="deck-eyebrow">Confirm paper trade · {sym.sym}</span>
              </div>
              <div className="p-6">
                <div id="confirm-trade-title" className="deck-display text-[1.75rem] leading-tight tracking-[-0.02em] text-fg">{confirm.strategy.kind}</div>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-fg-dim">{storySentence(confirm)}</p>
                {/* Risk before returns: the loss is read first. */}
                <div className="mt-6 grid grid-cols-3 border-y border-[var(--deck-rule)]">
                  {[
                    { k: "Max loss", v: Number.isFinite(confirm.strategy.maxLoss) ? `−$${Math.abs(confirm.strategy.maxLoss).toFixed(0)}` : "unbounded", c: "text-bear" },
                    { k: "Max profit", v: Number.isFinite(confirm.strategy.maxProfit) ? `+$${confirm.strategy.maxProfit.toFixed(0)}` : "uncapped", c: "text-bull" },
                    { k: "POP · BS model", v: `${(confirm.strategy.prob * 100).toFixed(0)}%`, c: "text-fg" },
                  ].map((s, i) => (
                    <div key={s.k} className={`py-3.5 ${i > 0 ? "border-l border-border pl-4" : "pr-4"}`}>
                      <div className="deck-label">{s.k}</div>
                      <div className={`mt-1.5 t-data text-[1.125rem] ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {confirmRefusal && (
                  <p role="alert" className="deck-note mt-5 px-3.5 py-2.5 text-[0.875rem] leading-relaxed">
                    {confirmRefusal}
                  </p>
                )}
                <div className="mt-6 flex items-center justify-end gap-2.5">
                  <button type="button" onClick={() => setConfirm(null)} className="deck-btn deck-btn-sm">
                    Cancel
                  </button>
                  <button type="button" onClick={confirmBet} disabled={!!confirmRefusal} className="deck-btn deck-btn-primary deck-btn-sm">
                    Place paper trade
                  </button>
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
            className="deck-pane fixed bottom-5 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] text-fg shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
          >
            <span aria-hidden className="grid size-5 place-items-center rounded-full bg-[var(--deck-green-tint)] text-[0.6875rem] text-bull">
              ✓
            </span>
            Paper trade placed · see the positions tab
          </motion.div>
        )}
      </AnimatePresence>

      {/* dead mount removed — no `onAsk`, so it rendered a button that did
          nothing. /trade/chain is the wired one. */}

      {/* The first-visit risk briefing. It was mounted ONLY on /trade/chain,
          so the page both CTAs actually point at — "get started" and "open
          the chain" — let you place your first trade with no briefing at
          all. It self-gates on the shared `wizardSeen` flag, so mounting it
          here shows it once across the site, never twice. */}
      <RiskWizard />
    </main>
  );
}

/** One step of the guided builder: the deck's journey numbering (slide 10),
 *  a mono "01" in green beside a serif question, a hairline above. */
function Step({ id, n, title, hint, children }: { id?: string; n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`step-${n}`} className="scroll-mt-24 border-t border-[var(--deck-rule)] pt-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span aria-hidden className="font-mono text-[0.875rem] tracking-[0.08em] text-bull">
          {n}
        </span>
        <h2 id={`step-${n}`} className="deck-h3 text-[clamp(1.375rem,2.2vw,1.75rem)] text-fg">
          {title}
        </h2>
      </div>
      {hint && <p className="mt-2 max-w-[46rem] text-[0.9375rem] leading-relaxed text-fg-dim">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Copy a deep link to THIS position. The whole growth loop, in one button:
 *  the memo's growth section named "No shareable 'copy this trade' card / deep
 *  link" as the one near-zero-cost channel the product did not have. */
function CopyLinkButton({ trade }: { trade: SharedTradeInput }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = shareUrl(trade);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      track("trade_shared", { legs: trade.legs.length });
    } catch {
      // No clipboard permission (or an insecure context) — say so rather than
      // pretending it worked.
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2200);
  };
  return (
    <button type="button" onClick={copy} title={url} className="deck-btn deck-btn-sm !h-7 !px-3 !text-[0.625rem]">
      {state === "copied" ? "✓ Link copied" : state === "failed" ? "Copy failed" : "Copy link ⧉"}
    </button>
  );
}

/** A position that arrived over a link. Rebuilt from the URL, priced with the
 *  same functions the rest of the page uses, and bookable into the same paper
 *  account — never anything else. */
function SharedTradePanel({
  trade,
  spot,
  placed,
  refusal,
  onPlace,
}: {
  trade: SharedTrade;
  spot: number;
  placed: boolean;
  /** Why the paper account would refuse it right now (training wheels, kill switch). */
  refusal: string | null;
  onPlace: () => void;
}) {
  const d = detect(trade.legs);
  const sum = pnlSummary(trade.legs, spot);
  const cost = trade.legs.reduce(
    (acc, l) => acc + (l.side === "long" ? 1 : -1) * l.premium * l.qty * 100,
    0
  );
  const fmt = (n: number) =>
    Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`;
  return (
    <section className="deck-pane overflow-hidden lg:shrink-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--deck-amber-line)] bg-[var(--deck-amber-tint)] px-5 py-2.5">
        <span className="deck-label text-amber">Shared trade · rebuilt in your builder · paper only</span>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="deck-display text-[1.5rem] tracking-[-0.02em] text-fg">{d.kind}</span>
          <span className="t-data text-[0.75rem] text-fg-dim">
            {trade.underlying} · {trade.daysToExpiry}d · spot ${spot.toFixed(2)}
          </span>
        </div>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-fg-dim">{d.blurb}</p>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {trade.legs.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-1 py-2 t-data text-[0.75rem]">
              <span className={l.side === "long" ? "text-bull" : "text-bear"}>
                {l.side === "long" ? "Buy" : "Sell"} {l.qty} {l.strike} {l.type === "C" ? "CALL" : "PUT"}
              </span>
              <span className={l.side === "long" ? "text-fg" : "text-bear"}>
                {l.side === "long" ? "" : "−"}
                {l.premium.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        {/* Risk before returns, as everywhere in the builder. */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1">
          {[
            { k: "Max loss", v: sum.unboundedRisk ? "unbounded" : fmt(sum.maxLoss), c: "text-bear" },
            { k: "Max profit", v: fmt(sum.maxProfit), c: "text-bull" },
            { k: sum.breakevens.length === 1 ? "Breakeven" : "Breakevens", v: sum.breakevens.length ? sum.breakevens.map((b) => b.toFixed(2)).join(" / ") : "—", c: "text-fg" },
          ].map((it) => (
            <div key={it.k}>
              <div className="deck-label">{it.k}</div>
              <div className={`mt-1 t-data text-[0.875rem] ${it.c}`}>{it.v}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onPlace}
          disabled={placed || !!refusal}
          className="deck-btn mt-4 h-auto min-h-10 w-full whitespace-normal py-2 text-left leading-snug !justify-between"
        >
          <span className="min-w-0">{placed ? "✓ Booked to your paper account" : `Open this on paper · ${cost > 0 ? "you pay" : "you collect"} $${Math.abs(cost).toFixed(0)}`}</span>
          <span aria-hidden>{placed ? "" : "→"}</span>
        </button>
        {refusal && !placed && <p className="mt-2 text-[0.875rem] text-amber">{refusal}</p>}
        <div className="mt-2 text-[0.75rem] text-fg-faint">
          Someone else built this · prices are yours, not theirs · nothing here is advice
        </div>
      </div>
    </section>
  );
}

/** AI teacher panel: explanation thread + "ask anything" input. Answers come
 *  from the same /api/explain flow the explain button uses — it describes the
 *  position the user built; it never gives advice. */
function TeacherPanel({
  selected,
  narrating,
  thread,
  paywall,
  disclosure,
  onDismissPaywall,
  onExplain,
  onAsk,
}: {
  selected: Strategy | null;
  narrating: boolean;
  thread: { role: "user" | "teacher"; text: string }[];
  paywall: PaywallBody | null;
  disclosure: string | null;
  onDismissPaywall: () => void;
  onExplain: () => void;
  onAsk: (q: string) => void;
}) {
  const [q, setQ] = useState("");
  // Collapsed to the header row until the reader asks for it — the empty-state
  // paragraph and input are disclosure, not default chrome.
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Follow the conversation — but ONLY once it is actually a conversation.
  //
  // This used to run on mount, with an empty thread, and `scrollIntoView` walks
  // up to whatever scrolls — which here is the document. The page therefore
  // scrolled ITSELF down 88px about half a second after load, before the reader
  // had touched anything: the ticker and the "strategy builder" eyebrow row slid out
  // of frame and the nav snapped to the top. Measured 0.434 CLS on /trade, the
  // worst number on the site after the homepage's film insertion.
  //
  // Guarding on growth keeps the intended behaviour (new teacher message pulls
  // itself into view) and removes the unrequested jump. The first render is a
  // baseline, never a scroll.
  const lastThreadLen = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastThreadLen.current;
    lastThreadLen.current = thread.length;
    if (prev === null || thread.length <= prev) return;
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
    <div className="mt-5">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onExplain();
        }}
        disabled={!selected || narrating}
        className="deck-btn w-full"
      >
        <Sparkles aria-hidden size={14} strokeWidth={1.75} className="text-bull" />
        Explain this position
        <span className="rounded-[4px] bg-[var(--deck-raised)] px-1.5 py-0.5 text-[0.5625rem] tracking-[0.1em] text-fg-faint">Beta</span>
      </button>

      {open && (
      <>
      <div className="mt-3 flex max-h-[18.75rem] min-h-[7.5rem] flex-col gap-3 overflow-y-auto lg:max-h-[15rem]">
        {thread.length === 0 && !narrating && (
          <TeacherBubble
            speaker="teacher"
            text={
              selected
                ? `This panel describes the ${selected.kind} you built — max profit, max loss, breakevens, and what can go wrong. Press “Explain this position”, or type a question below.`
                : "Pick an example strategy to get a plain-English read of the position."
            }
          />
        )}
        {thread.map((m, i) => (
          <TeacherBubble key={i} speaker={m.role} text={m.text} />
        ))}
        {narrating && <TeacherBubble speaker="teacher" text="Teacher is thinking…" thinking />}
        {paywall && !narrating && <UpgradeNudge paywall={paywall} onClose={onDismissPaywall} />}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about this trade..."
          disabled={!selected}
          className="calm-input min-w-0 flex-1 outline-none transition-colors placeholder:text-fg-faint disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!selected || narrating || !q.trim()}
          aria-label="ask the teacher"
          className="deck-btn !size-9 shrink-0 !p-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </form>
      {/* The server's disclosure string once an answer has arrived
          (lib/billing/explain-policy.ts); the house line before that. */}
      <div className="mt-2 text-[0.75rem] text-fg-faint">
        {disclosure ?? "Describes the position you built · education, not advice"}
      </div>
      </>
      )}
    </div>
  );
}

// `speaker` (not `role`) so a JSX `speaker="teacher"` can never be misread as a
// DOM ARIA role — it styles the chat bubble, it is never a DOM attribute.
function TeacherBubble({ speaker, text, thinking }: { speaker: "user" | "teacher"; text: string; thinking?: boolean }) {
  if (speaker === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-[var(--deck-raised)] px-3 py-2 text-[0.8125rem] leading-relaxed text-fg">{text}</div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className="grid size-8 shrink-0 select-none place-items-center rounded-[8px] bg-[var(--deck-green-tint)] font-mono text-[0.75rem] text-bull" aria-hidden>
        :]
      </span>
      <div
        className={`relative max-w-[85%] whitespace-pre-line rounded-[12px] rounded-bl-[4px] border border-border bg-[var(--deck-sunk)] px-3 py-2 leading-relaxed ${
          thinking ? "text-[0.8125rem] text-fg-faint" : "text-[0.8125rem] text-fg"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
