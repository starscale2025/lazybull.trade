"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ProbabilityCone } from "@/components/wedge/ProbabilityCone";
import { StrategyCards, PnlSparkline, EmptyPnlSparkline } from "@/components/wedge/StrategyCards";
import { PlainGreeks } from "@/components/wedge/PlainGreeks";
import { TimeMachine } from "@/components/wedge/TimeMachine";
import { EventTimeline } from "@/components/wedge/EventTimeline";
import { ModelSpread } from "@/components/wedge/ModelSpread";
import { ManagePanel } from "@/components/wedge/ManagePanel";
import { ChainTable } from "@/components/wedge/ChainTable";
import { BetBar } from "@/components/wedge/BetSlip";
import { storySentence, type Bet } from "@/components/wedge/PositionStory";
import { bullCallSpread, generateStrategies, probBS, type Strategy } from "@/lib/models";
import { useChosenPosition } from "@/lib/hero-position";
import { DAYS as SIM_DAYS, IV as SIM_IV, SPOT as SIM_SPOT } from "@/lib/hero-spread";
import { optionOpenRefusal, usePaper, useSafety } from "@/lib/stores";
import { useModalFocus } from "@/components/safety/useModalFocus";
import { RegulatoryLine } from "@/components/RegulatoryLine";
import { RiskWizard } from "@/components/safety/RiskWizard";
import { eventsFor } from "@/lib/events";
import { UpgradeNudge } from "@/components/billing/UpgradeNudge";
import { isPaywall, type PaywallBody } from "@/lib/billing/gate";
import { decodeLegs, shareUrl, type SharedTrade, type SharedTradeInput } from "@/lib/share-trade";
import { detect } from "@/lib/detector";
import { pnlSummary, type Leg } from "@/lib/pricing";
import { noteBuilderAbandon, noteExplainRequest, tradeFingerprint } from "@/lib/confusion";
import { flushEvents, track } from "@/lib/track";
import { clearIsland, setIsland } from "@/lib/island";
import { TruthBadge } from "@/components/pro/TruthBadge";
import { CalmLink, Chip, TogglePill, ToolButton } from "@/components/calm/kit";

// IV is still synthetic (no free options-IV feed); spot is now live.
const SYMBOLS = [
  { sym: "AMZN", name: "Amazon", spot: 226.45, iv: 0.32 },
  { sym: "NVDA", name: "Nvidia", spot: 138.9, iv: 0.46 },
  { sym: "TSLA", name: "Tesla", spot: 287.15, iv: 0.55 },
  { sym: "AAPL", name: "Apple", spot: 229.83, iv: 0.28 },
  { sym: "SPY", name: "S&P 500", spot: 612.4, iv: 0.16 },
];
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

// The "under the hood" analytics panels, one at a time (progressive disclosure).
const TABS = [
  { id: "whatif", label: "What-if machine" },
  { id: "greeks", label: "Greeks" },
  { id: "events", label: "Event horizon" },
  { id: "models", label: "Model spread" },
  { id: "manage", label: "Positions" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// The kit's controls stand 32px tall. This page fits one screen and its toolbars
// and panel headers are thin strips, so here they take a compact size; touch
// still gets 44px from the tap-floor on <main>.
const DENSE = "!h-6 !px-2.5 !text-[0.75rem]";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

  // Header stat cluster — IV rank/percentile are derived from the synthetic
  // base IV (no real IV-history feed), so the whole cluster carries an
  // "illustrative" tag, same convention as the Source: Mock chips.
  const symSeed = sym.sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const ivRank = Math.round(Math.min(98, Math.max(2, ((sym.iv - 0.12) / (0.55 - 0.12)) * 100)));
  const ivPctile = Math.round(Math.min(98, Math.max(2, ivRank + ((symSeed % 13) - 6))));

  // Next earnings from the same deterministic event calendar the timeline uses.
  const nextEarnings = useMemo(() => {
    if (sym === SIM) return null; // an index nobody reports earnings for
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 120);
    return eventsFor(sym.sym, start, end).find((e) => e.kind === "earnings") ?? null;
  }, [sym]);
  // Calendar text waits for the browser's clock (Gate A4 #2, React #418): the
  // server's day is not the reader's near midnight, east of UTC, and a page
  // that printed the server's date failed to hydrate.
  const earnDays =
    nextEarnings && mounted
      ? Math.max(0, Math.ceil((new Date(nextEarnings.date).getTime() - Date.now()) / 86_400_000))
      : null;
  const earnLabel =
    nextEarnings && mounted
      ? new Date(nextEarnings.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—";

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
    return eventsFor(sym.sym, start, end);
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
    setConfirm(b);
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

  // the range sentence — the visitor's own range, never a first-person forecast
  const rangeLine = `Your range: ${sym.sym} between $${low.toFixed(2)} and $${high.toFixed(2)}`;
  const thesisSentence = touched
    ? `${rangeLine} by ${fmtDate(dateNDaysOut(days))}.`
    : "Drag the green band to set a price range.";

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

  return (
    <main className="tap-floor flex min-h-screen flex-col bg-bg pb-20 text-fg lg:pb-0">
      {/* No AmbientOrbs / CursorSpotlight here: the homepage's drifting
          atmosphere is marketing language, and on a route that is nothing but
          live numbers it reads as movement the data did not ask for. */}
      <ScrollProgress />
      <TickerBar />
      <Nav wide />

      {/* ── App shell: on lg+ everything below the nav fits one screen and panels
             scroll internally. 91px = measured TickerBar (33.5px) + Nav (57px).
             100vh is divided by --ui-zoom because html{zoom} does not shrink
             viewport units — same convention as globals.css's .h-screen rule. */}
      <div className="flex flex-col lg:h-[calc(100vh/var(--ui-zoom)_-_91px)] lg:overflow-hidden">
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
        <div className="relative shell shell-wide py-4 lg:py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-2">
            <div className="flex items-center gap-3 t-eyebrow text-fg-faint" data-gsap="fade-up">
              Strategy builder
              <CalmLink href="/trade/chain" className="!text-[0.875rem]">Advanced view: see the chain</CalmLink>
            </div>
            <Chip tone="warn">Paper only · $5k practice account</Chip>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 lg:mt-3 lg:items-center">
            {/* symbol block — one dense baseline row on lg */}
            <div className="lg:flex lg:flex-wrap lg:items-baseline lg:gap-x-4" data-gsap="fade-up">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-[clamp(1.9rem,3vw,2.6rem)] leading-none tracking-tightest text-fg lg:text-[1.7rem]">
                  {sym.sym}
                </h1>
                <span className="t-label text-fg-dim">{quote?.name ?? sym.name}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-3 t-data lg:mt-0">
                <span className="text-2xl text-fg lg:text-xl">${spot.toFixed(2)}</span>
                <span className={`text-sm ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                  {chg >= 0 ? "+" : "−"}{Math.abs(chg).toFixed(2)} ({chg >= 0 ? "+" : "−"}{Math.abs(chgPct).toFixed(2)}%)
                </span>
              </div>
              <div className="mt-1 lg:mt-0">
                <Chip dot tone={quote ? "neutral" : "warn"}>
                  {isSim
                    ? "Synthetic index · not a real security"
                    : quote
                      ? `Live price · ${quote.exch ?? "US market"}`
                      : "Seed price · connecting"}
                </Chip>
              </div>
              {/* Provenance where the data is (M33): the chain behind this
                  builder is synthetic and the badge says so, here rather than
                  on the nav of every page. */}
              <div className="mt-2">
                <TruthBadge />
              </div>
            </div>

            {/* IV / earnings cluster — synthetic; the amber dot carries the
                illustrative disclosure so the chip no longer repeats it */}
            <div
              className="flex items-center gap-2.5 lg:gap-3"
              data-gsap="fade-up"
              data-gsap-delay="0.08"
              title="Illustrative · synthetic IV (no real options-IV feed)"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
              <div className="flex divide-x divide-border t-data">
                {[
                  { k: "IV rank", v: String(ivRank) },
                  { k: "IV percentile", v: `${ivPctile}%` },
                  { k: "IV", v: `${(sym.iv * 100).toFixed(1)}%` },
                ].map((s) => (
                  <div key={s.k} className="px-4 text-right first:pl-0">
                    <div className="t-label text-fg-faint">{s.k}</div>
                    <div className="mt-1 text-lg tabular-nums text-fg lg:mt-0.5 lg:text-base">{s.v}</div>
                  </div>
                ))}
                <div className="px-4 pr-0 text-right">
                  <div className="t-label text-fg-faint">Earnings</div>
                  <div className="mt-1 flex items-baseline justify-end gap-1.5 lg:mt-0.5">
                    <span className="text-lg tabular-nums text-fg lg:text-base">{earnLabel}</span>
                    {earnDays != null && <Chip>{earnDays}d</Chip>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Terminal grid: chart + chain (≈60%) | strategy · greeks · teacher (≈40%) */}
      <div className="relative grid shell shell-wide grid-cols-1 items-start gap-4 py-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-3 lg:overflow-hidden lg:py-3">
        {/* ---- left column: toolbar → cone chart → chain (internal scroll) ---- */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:gap-3 lg:overflow-hidden">
          {/* toolbar strip — live controls only */}
          {/* wraps at every width — clipping "reset view" behind an invisible
              x-scroll is worse than a second toolbar row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 surface-instrument border border-border bg-surface px-3 py-2 t-label lg:shrink-0 lg:gap-x-3">
            <span className="text-fg-faint">Underlying</span>
            <div className="flex items-center gap-1">
              {symbols.map((s) => (
                <TogglePill key={s.sym} on={s.sym === sym.sym} onClick={() => pickSymbol(s.sym)} className={DENSE}>
                  {s.sym}
                </TogglePill>
              ))}
            </div>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <label className="flex items-center gap-2 text-fg-faint">
              Strikes
              <select
                value={chainDepth}
                onChange={(e) => setChainDepth(Number(e.target.value))}
                className="rounded-[var(--r-instrument)] border border-border bg-bg px-1.5 py-0.5 t-data text-[0.6875rem] text-fg-dim outline-none focus:border-brand-ink/60"
              >
                <option value={4}>±4</option>
                <option value={5}>±5</option>
                <option value={8}>±8</option>
              </select>
            </label>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            {/* days-from-now slider — drives the same `days` state as the cone drag + chain stepper */}
            <label className="flex shrink-0 items-center gap-2 text-fg-faint">
              Days from now
              <input
                type="range"
                min={1}
                max={365}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-1 w-24 accent-brand-ink xl:w-32"
                aria-label="days from now"
              />
              <span className="text-amber tabular-nums">
                {days}d{mounted && <span className="lg:hidden"> · {expiryStr}</span>}
              </span>
            </label>
            <ToolButton onClick={resetView} className={`ml-auto shrink-0 ${DENSE}`}>
              Reset view ⟲
            </ToolButton>
          </div>

          {/* chart + draggable probability cone — ≈55% of the column on lg */}
          <section id="thesis" className="scroll-mt-16 surface-instrument border border-border bg-surface lg:flex lg:min-h-0 lg:shrink-0 lg:grow-0 lg:basis-[55%] lg:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-soft px-3 py-2 lg:shrink-0">
              <span className="t-eyebrow text-fg-dim">Implied range · Black-Scholes · {sym.sym}</span>
              {/* the expiry date is the decision token — keep it shrink-0 so
                  mid-width truncation eats the prose, never the date */}
              <span
                title={touched ? thesisSentence : undefined}
                className="hidden min-w-0 max-w-[62%] items-baseline gap-1 t-label text-fg-dim md:flex"
              >
                {touched ? (
                  <>
                    <span className="min-w-0 truncate">
                      <ThesisLine sentence={rangeLine} />
                    </span>
                    <span className="shrink-0 text-amber">by {expiryStr}.</span>
                  </>
                ) : (
                  <span className="min-w-0 truncate">{thesisSentence}</span>
                )}
              </span>
            </div>
            <div className="relative h-[26.25rem] bg-bg lg:h-auto lg:min-h-0 lg:flex-1">
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
                <div className="flex h-full items-center justify-center t-label text-fg-faint">Loading implied range…</div>
              )}
              {/* in-band probability ring — same number the strategy panel prices
                  from. Owns the top-left corner: the HI/LO inputs moved into the
                  cone's header bar, so nothing else shares this edge. */}
              <div className="pointer-events-none absolute left-2 top-2 z-10 hidden sm:block">
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
            onHoverStrike={setHoverStrike}
          />
        </div>

        {/* ---- right rail: strategy · greeks · teacher · analytics — its own scroll ---- */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:gap-3 lg:overflow-y-auto">
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

          {/* strategy panel — picker + legs + payoff/stat rail + place CTA, all inside */}
          <section id="pick" className="scroll-mt-16 surface-instrument border border-border bg-surface lg:shrink-0">
            {isSim && brought && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <Chip tone="brand">Your spread from the home page · paper</Chip>
                {selectedId !== "brought" && (
                  <button type="button" onClick={() => setSelectedId("brought")} className="tool-btn tool-btn-sm">
                    Show your spread
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2">
              <span className="t-eyebrow text-fg-dim">Examples that fit this range</span>
              <Link href="/trade/chain" className={`tool-btn ${DENSE}`}>
                Edit legs ✎
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
            {/* nothing picked yet: the payoff frame, empty (see EmptyStrategyDetail) */}
            {!selected && <EmptyStrategyDetail spot={spot} />}
            {selected && <LegsList s={selected} />}
            {selected && (
              <StrategyDetail
                s={selected}
                symbol={sym.sym}
                spot={spot}
                daysToExpiry={days}
                prob={probInBand}
                onPlace={() => placeBet(selected)}
                placeNote={isSim ? SIM_NOTE : undefined}
              />
            )}
          </section>

          {/* AI teacher */}
          <TeacherPanel
            selected={selected}
            narrating={narrating}
            thread={thread}
            paywall={paywall}
            disclosure={disclosure}
            onDismissPaywall={() => setPaywall(null)}
            onExplain={() => selected && narrate(selected)}
            onAsk={(q) => selected && narrate(selected, q)}
          />

          {/* under the hood — one analytics panel at a time, compact rail edition */}
          <section id="detail" className="scroll-mt-16 surface-instrument border border-border bg-surface lg:shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-bg-soft px-2 py-1.5">
              {TABS.map((t) => (
                <TogglePill key={t.id} on={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 ${DENSE}`}>
                  {t.label}
                  {t.id === "manage" ? ` (${openCount})` : ""}
                </TogglePill>
              ))}
            </div>
            <div id="manage" className="scroll-mt-16">
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
            </div>
          </section>
        </div>
      </div>
      </div>{/* /app shell */}
      <RegulatoryLine className="shell py-3" />

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
            className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
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
              className="surface-instrument w-full max-w-xl border border-border bg-bg shadow-2xl outline-none"
            >
              <div className="border-b border-border bg-bg-soft px-4 py-2 t-eyebrow text-fg-dim">
                Confirm paper trade · {sym.sym}
              </div>
              <div className="p-6">
                <div id="confirm-trade-title" className="font-display text-2xl tracking-tightest text-fg">{confirm.strategy.kind}</div>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-fg">{storySentence(confirm)}</p>
                <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
                  {[
                    { k: "Max profit", v: Number.isFinite(confirm.strategy.maxProfit) ? `+$${confirm.strategy.maxProfit.toFixed(0)}` : "uncapped", c: "text-bull" },
                    { k: "Max loss", v: Number.isFinite(confirm.strategy.maxLoss) ? `−$${Math.abs(confirm.strategy.maxLoss).toFixed(0)}` : "unbounded", c: "text-bear" },
                    { k: "In-range probability · BS model", v: `${(confirm.strategy.prob * 100).toFixed(0)}%`, c: "text-fg" },
                  ].map((s) => (
                    <div key={s.k} className="bg-bg p-3">
                      <div className="t-label text-fg-faint">{s.k}</div>
                      <div className={`mt-1 t-data text-base ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {confirmRefusal && (
                  <p role="alert" className="mt-4 rounded-[var(--r-instrument)] bg-amber/10 px-3 py-2 t-body-sm text-amber">
                    {confirmRefusal}
                  </p>
                )}
                <div className="mt-5 flex items-center justify-end gap-2">
                  <ToolButton onClick={() => setConfirm(null)}>Cancel</ToolButton>
                  <ToolButton primary onClick={confirmBet} disabled={!!confirmRefusal}>Place paper trade</ToolButton>
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
            className="surface-instrument fixed bottom-5 left-1/2 z-[var(--z-toast)] -translate-x-1/2 border border-border bg-bg px-4 py-2 t-label text-fg shadow-2xl"
          >
            ✓ Paper trade placed · see the positions tab
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

/** Ring gauge overlaid on the chart — "N% in band · probability @ expiration". */
function InBandRing({ prob }: { prob: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, prob));
  // prob comes back from probBS, which runs Math.log and an erf — neither is
  // specified to the last ULP, so Node and the browser can land on different
  // final digits. Rounding the dash geometry keeps the attribute identical on
  // both sides; see the same guard in Sparkline (components/wedge/StrategyCards).
  const dash = c.toFixed(2);
  const dashOffset = (c - c * p).toFixed(2);
  const tone = prob > 0.6 ? "var(--bull)" : prob > 0.35 ? "var(--cyan)" : "var(--bear)";
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
          <circle cx="52" cy="52" r={r} stroke="var(--border)" strokeWidth="6" fill="var(--bg)" fillOpacity="0.55" />
          <circle
            cx="52"
            cy="52"
            r={r}
            stroke={tone}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 52 52)"
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(.22,.68,.26,1), stroke 0.3s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl leading-none tracking-tightest tabular-nums" style={{ color: tone }}>
            {Math.round(prob * 100)}%
          </span>
          <span className="mt-1 t-label text-fg-dim">In band</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 t-label text-fg-faint">
        <span className="size-2 shrink-0 border border-bull/60 bg-bull/20" aria-hidden />
        <span>Probability<br />@ expiration</span>
      </div>
    </div>
  );
}

/** The selected strategy's legs, broker-ticket style: Buy/Sell qty strike type · mid.
 *  Collapsed by default — the ticket rows duplicate what "edit legs" opens, so
 *  they are disclosure; only the net debit/credit line is always-on. */
function LegsList({ s }: { s: Strategy }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-bg-soft px-3 py-1.5 t-label text-fg-faint transition-colors hover:text-fg"
      >
        <span>Legs ({s.legs.length}) {open ? "▾" : "▸"}</span>
        <span>{open ? "Mid px" : ""}</span>
      </button>
      {open && (
        <ul className="divide-y divide-border-soft border-t border-border-soft">
          {s.legs.map((l, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 t-data text-[0.75rem]">
              <span className={l.side === "long" ? "text-bull" : "text-bear"}>
                {l.side === "long" ? "Buy" : "Sell"} {l.qty} {l.strike} {l.type === "C" ? "CALL" : "PUT"}
              </span>
              <span className={l.side === "long" ? "text-fg" : "text-bear"}>
                {l.side === "long" ? "" : "−"}{l.premium.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* The net debit/credit is the price of the whole trade — the single
          number a beginner is most likely to be looking for. It used to sit
          at 12px, identical to the chrome around it. */}
      <div className="flex items-baseline justify-between border-t border-border-soft bg-bg px-3 py-2.5">
        <span className="t-label text-fg-dim">{s.cost > 0 ? "Net debit" : "Net credit"}</span>
        <span className={`t-figure ${s.cost > 0 ? "text-fg" : "text-bull"}`}>
          {Math.abs(s.cost / 100).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/** The strategy panel before anything is picked. /trade opens with no position
 *  (see selectedId), and this panel used to end at the three example rows, so
 *  the first view of a product whose promise is "options you can see" had no
 *  picture in it. This is StrategyDetail's frame with nothing in it: the $0
 *  axis and today's spot, the rail's labels with no figures, and no legs and no
 *  place button, because nothing has been chosen. */
function EmptyStrategyDetail({ spot }: { spot: number }) {
  return (
    <div className="@container border-t border-border p-3">
      <div className="flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <EmptyPnlSparkline spot={spot} note="Pick an example to draw it" />
          <div className="mt-1 text-center t-label text-fg-faint">P/L @ expiration</div>
        </div>
        {/* the rail StrategyDetail fills in, unfilled. Beside a 12.5rem rail a
            narrow panel leaves the frame too thin for its note (phones, and the
            desktop rail below ~1360px), so it waits on the panel's own width:
            a container query, not a viewport breakpoint. */}
        <div aria-hidden className="hidden w-[12.5rem] shrink-0 grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5 @md:grid">
          {["Max profit", "Max loss", "Breakeven", "POP"].map((k) => (
            <div key={k} className="contents">
              <span className="t-label text-fg-faint">{k}</span>
              <span className="text-right t-data text-[0.75rem] text-fg-faint">—</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Selected-strategy detail, ref-style: fact chips, payoff diagram beside a
 *  snug label/value stat rail, and the place-trade CTA — all inside the panel. */
function StrategyDetail({
  s,
  symbol,
  spot,
  daysToExpiry,
  prob,
  onPlace,
  placeNote,
}: {
  s: Strategy;
  symbol: string;
  spot: number;
  daysToExpiry: number;
  prob: number;
  onPlace: () => void;
  /** Why this position cannot be placed, in place of the button. */
  placeNote?: string;
}) {
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
    ...(Number.isFinite(s.cost) ? [s.cost > 0 ? "Debit" : "Credit"] : []),
    cap(s.bias),
    ...(definedRisk ? ["Defined risk"] : []),
  ];
  const rr =
    Number.isFinite(s.maxProfit) && definedRisk && Math.abs(s.maxLoss) > 0 ? s.maxProfit / Math.abs(s.maxLoss) : null;
  // `lead` marks the figures the decision actually turns on. They get the
  // decision tier; the rest stay chrome-sized so the promotion means something.
  const rail: { k: string; v: string; c: string; lead?: boolean }[] = [
    { k: "Max profit", v: fmt(s.maxProfit), c: "text-bull", lead: true },
    { k: "Max loss", v: fmt(s.maxLoss), c: "text-bear", lead: true },
    ...(s.breakevens.length
      ? [{ k: "Breakeven", v: s.breakevens.map((b) => b.toFixed(2)).join(" / "), c: "text-fg" }]
      : []),
    { k: "POP", v: `${(s.prob * 100).toFixed(0)}%`, c: "text-bull", lead: true },
    ...(rr != null ? [{ k: "R:R", v: rr.toFixed(2), c: "text-fg" }] : []),
  ];

  return (
    <div className="border-t border-border p-3">
      {/* fact chips — derived from the strategy, never invented */}
      <div className="flex flex-wrap items-center gap-1">
        {chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        <span className="ml-auto t-label text-fg-faint tabular-nums">
          {s.cost > 0 ? "You pay" : "You collect"} ${Math.abs(s.cost).toFixed(0)}
        </span>
      </div>

      {/* payoff diagram | snug stat rail */}
      <div className="mt-3 flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <PnlSparkline s={s} spot={spot} className="w-full min-h-16 flex-1" />
          <div className="mt-1 text-center t-label text-fg-faint">
            P/L @ expiration
          </div>
        </div>
        <div className="grid w-[12.5rem] shrink-0 grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5">
          {rail.map((it) => (
            <div key={it.k} className="contents">
              <span className={`t-label ${it.lead ? "self-center text-fg-dim" : "text-fg-faint"}`}>{it.k}</span>
              <span className={`text-right ${it.lead ? "t-figure" : "t-data text-[0.75rem]"} ${it.c}`}>{it.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* place CTA — the page's one main action, inside the panel */}
      {placeNote ? (
        <p className="mt-3 t-label text-fg-dim">{placeNote}</p>
      ) : (
        <ToolButton primary onClick={onPlace} className="mt-3 w-full !h-9 !justify-between">
          <span>Place this trade on {symbol}</span>
          <span>→</span>
        </ToolButton>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <CopyLinkButton
          trade={{ underlying: symbol, spot, daysToExpiry, legs: s.legs }}
        />
        <span className="ml-auto t-label text-fg-faint">
          {Math.round(prob * 100)}% in band · Black-Scholes · paper only
        </span>
      </div>
    </div>
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
    <ToolButton onClick={copy} title={url} className={DENSE}>
      {state === "copied" ? "✓ Link copied" : state === "failed" ? "Copy failed" : "Copy link ⧉"}
    </ToolButton>
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
    <section className="surface-instrument border border-border bg-surface lg:shrink-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-soft px-3 py-2">
        <span className="t-eyebrow text-amber">Shared trade · rebuilt in your builder · paper only</span>
      </div>
      <div className="p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-xl tracking-tightest text-fg">{d.kind}</span>
          <span className="t-data text-[0.75rem] text-fg-dim">
            {trade.underlying} · {trade.daysToExpiry}d · spot ${spot.toFixed(2)}
          </span>
        </div>
        <p className="t-body-sm mt-1.5 text-fg-dim">{d.blurb}</p>
        <ul className="mt-2 divide-y divide-border-soft border-y border-border-soft">
          {trade.legs.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-1 py-1.5 t-data text-[0.75rem]">
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
        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
          {[
            { k: "Max profit", v: fmt(sum.maxProfit), c: "text-bull" },
            { k: "Max loss", v: sum.unboundedRisk ? "unbounded" : fmt(sum.maxLoss), c: "text-bear" },
            { k: sum.breakevens.length === 1 ? "Breakeven" : "Breakevens", v: sum.breakevens.length ? sum.breakevens.map((b) => b.toFixed(2)).join(" / ") : "—", c: "text-fg" },
          ].map((it) => (
            <div key={it.k}>
              <div className="t-label text-fg-faint">{it.k}</div>
              <div className={`t-data text-[0.8125rem] ${it.c}`}>{it.v}</div>
            </div>
          ))}
        </div>
        <ToolButton onClick={onPlace} disabled={placed || !!refusal} className="mt-3 w-full !h-9 !justify-between">
          <span>{placed ? "✓ Booked to your paper account" : `Open this on paper · ${cost > 0 ? "you pay" : "you collect"} $${Math.abs(cost).toFixed(0)}`}</span>
          <span>{placed ? "" : "→"}</span>
        </ToolButton>
        {refusal && !placed && <p className="mt-2 t-body-sm text-amber">{refusal}</p>}
        <div className="mt-1.5 t-label text-fg-faint">
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
    <section className="flex flex-col surface-instrument border border-border bg-surface lg:shrink-0">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2">
        <span className="flex items-center gap-2 t-eyebrow text-fg-dim">
          AI teacher
          <Chip>Beta</Chip>
        </span>
        <ToolButton
          onClick={() => {
            setOpen(true);
            onExplain();
          }}
          disabled={!selected || narrating}
          className={DENSE}
        >
          Explain this position
        </ToolButton>
      </div>

      {open && (
      <>
      <div className="flex max-h-[18.75rem] min-h-[10rem] flex-col gap-3 overflow-y-auto p-3 lg:max-h-[15rem] lg:min-h-[7.5rem]">
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

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-bg-soft p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything about this trade..."
          disabled={!selected}
          className="min-w-0 flex-1 rounded-[var(--r-instrument)] border border-border bg-bg px-3 py-2 text-[0.8125rem] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-brand-ink/60 disabled:opacity-50"
        />
        <ToolButton
          type="submit"
          disabled={!selected || narrating || !q.trim()}
          aria-label="ask the teacher"
          className="!size-9 shrink-0 !p-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </ToolButton>
      </form>
      {/* The server's disclosure string once an answer has arrived
          (lib/billing/explain-policy.ts); the house line before that. */}
      <div className="border-t border-border-soft px-3 py-1.5 t-label text-fg-faint">
        {disclosure ?? "Describes the position you built · education, not advice"}
      </div>
      </>
      )}
    </section>
  );
}

// `speaker` (not `role`) so a JSX `speaker="teacher"` can never be misread as a
// DOM ARIA role — it styles the chat bubble, it is never a DOM attribute.
function TeacherBubble({ speaker, text, thinking }: { speaker: "user" | "teacher"; text: string; thinking?: boolean }) {
  if (speaker === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] border border-border bg-bg-soft px-3 py-2 text-[0.75rem] leading-relaxed text-fg">{text}</div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className="flex size-8 shrink-0 select-none items-center justify-center rounded-[var(--r-instrument)] border border-border bg-bg font-mono text-[0.75rem] text-brand-ink" aria-hidden>
        :]
      </span>
      <div
        className={`relative max-w-[85%] whitespace-pre-line border border-border bg-surface px-3 py-2 leading-relaxed ${
          thinking ? "text-[0.75rem] text-fg-faint" : "text-[0.75rem] text-fg"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
