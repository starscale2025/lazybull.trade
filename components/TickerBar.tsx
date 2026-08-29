"use client";

import { useEffect, useMemo, useState } from "react";
import { applyWonk, wonkFromVix } from "@/lib/wonk";
import { useLiveQuotes } from "@/lib/streaming/useLiveQuotes";
import { syntheticQuotes } from "@/lib/live-bars";

const SYMBOLS = [
  "AMZN", "NVDA", "TSLA", "AAPL", "MSFT", "AMD",
  "META", "GOOGL", "SPY", "QQQ", "IWM", "GLD",
  "^VIX", "GME", "PLTR", "COIN", "AVGO", "NFLX",
];

const DISPLAY: Record<string, string> = { "^VIX": "VIX" };

function fmtPrice(n: number): string {
  return n.toFixed(2);
}
function fmtPct(p: number): string {
  const s = p >= 0 ? "+" : "−";
  return `${s}${Math.abs(p).toFixed(2)}%`;
}
function fmtClock(d: Date): string {
  return d.toUTCString().split(" ")[4]; // HH:MM:SS
}

export function TickerBar() {
  // Live prices now PUSH over one shared SSE stream (see lib/streaming) instead
  // of this component polling — the marquee ticks the moment a quote changes,
  // with no per-component interval. The manager falls back to polling
  // /api/quote-batch automatically if the stream can't establish.
  const live = useLiveQuotes(SYMBOLS);
  const [clock, setClock] = useState<string>("");

  const liveQuotes = SYMBOLS.map((s) => live[s]).filter((q): q is NonNullable<typeof q> => !!q);
  const haveLive = liveQuotes.length > 0;

  // The stream can be perfectly healthy (hello + heartbeats) and still carry NO
  // quotes — that's Tier D: every provider unconfigured or rate-limited. The rail
  // used to sit on "connecting…" forever in that case. After a grace period we
  // fall back to the deterministic simulated tape and SAY SO (the LIVE lamp flips
  // to SIM), so the desk looks alive without ever passing fake prices off as real.
  const [feedDead, setFeedDead] = useState(false);
  useEffect(() => {
    if (haveLive) {
      setFeedDead(false); // real quotes arrived (or came back) → live wins
      return;
    }
    const id = setTimeout(() => setFeedDead(true), 6000);
    return () => clearTimeout(id);
  }, [haveLive]);

  const simBase = useMemo(() => syntheticQuotes(SYMBOLS), []);
  const usingSim = feedDead && !haveLive;

  // A tape whose digits never move reads as frozen, so the simulated rail
  // breathes: one 4s timer nudges every price along a bounded sine (±0.15%),
  // phase-shifted per symbol. Bounded (not a walk) so it can't drift somewhere
  // silly over a long-lived tab, and it only runs while the feed is down.
  const [simTick, setSimTick] = useState(0);
  useEffect(() => {
    if (!usingSim) return;
    const id = setInterval(() => setSimTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, [usingSim]);

  const quotes = usingSim
    ? simBase.map((q, i) => {
        const prev = q.last - q.chg;
        const last = q.last * (1 + Math.sin((simTick + i * 7) * 0.7) * 0.0015);
        const chg = last - prev;
        return { ...q, last, chg, chgPct: prev ? (chg / prev) * 100 : 0 };
      })
    : liveQuotes;

  // The Volatility Wonk: the VIX drives Fraunces' WONK/SOFT axes (see lib/wonk.ts
  // and .wonk-type in globals.css) — from the simulated tape too, so the type
  // still breathes while the feed is down.
  // Read the STABLE base (not the breathing tick) so the type doesn't re-warp
  // every 4 seconds while the feed is down.
  const vix = usingSim ? simBase.find((q) => q.sym === "^VIX")?.last : live["^VIX"]?.last;
  useEffect(() => {
    if (typeof vix === "number" && Number.isFinite(vix)) applyWonk(wonkFromVix(vix));
  }, [vix]);
  // WONK legend — announce the volatility BAND (not every tick, so it doesn't
  // spam), so screen readers + skimmers know the headline type reacts to it.
  const wonkBand =
    typeof vix !== "number" ? null : vix < 15 ? "calm" : vix < 20 ? "normal" : vix < 28 ? "elevated" : "high";

  // Wall clock
  useEffect(() => {
    setClock(fmtClock(new Date()));
    const id = setInterval(() => setClock(fmtClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const [paused, setPaused] = useState(false);
  const items = quotes.length > 0 ? [...quotes, ...quotes] : [];
  const marketState = live["SPY"]?.marketState ?? "";
  const stateLabel =
    usingSim ? "SIMULATED TAPE" :
    marketState === "REGULAR" ? "NYSE OPEN" :
    marketState === "PRE" ? "PRE-MARKET" :
    marketState === "POST" ? "POST-MARKET" :
    marketState === "CLOSED" ? "MARKET CLOSED" :
    "WAITING…";

  return (
    <div
      className={`flex items-stretch overflow-hidden border-b border-border bg-bg font-mono text-[11px] uppercase tracking-wider ${paused ? "marquee-paused" : ""}`}
    >
      {/* WONK legend — the headline serif warps with the VIX; this makes that
          "the type IS a volatility gauge" signal legible to screen readers and
          skimmers. Band-only text so it announces on regime flips, not ticks. */}
      <span className="sr-only" aria-live="polite">
        {wonkBand
          ? `Market volatility is ${wonkBand}. The headline type ${
              wonkBand === "calm" ? "sits calm and upright." : "warps with the tape."
            }`
          : ""}
      </span>
      {/* Static shrink-0 sibling (not an overlay): the tape track starts AFTER
          this pill whatever the label width, so no quote ever hides under it. */}
      <div className="flex shrink-0 items-center gap-2 border-r border-border pl-3 pr-4">
        {/* The lamp must never say LIVE over simulated prices — that's the one
            lie this rail could tell. When the feed is down the whole claim is
            just the amber lamp (title + sr-only carry the words) — the Nav
            Truth badge is the canonical SYNTHETIC indicator, so the rail
            doesn't repeat it in text. Green pulsing LIVE only over real quotes. */}
        <span
          className={`size-1.5 rounded-full ${usingSim ? "bg-amber" : "bg-bull pulse-dot"}`}
          title={usingSim ? "No live feed — showing a deterministic simulated tape, not real quotes." : undefined}
        />
        {usingSim ? (
          <span className="sr-only">Simulated tape — not real quotes.</span>
        ) : (
          <>
            <span className="text-bull">LIVE</span>
            <span className="hidden text-fg-faint sm:inline">·</span>
            <span className="hidden text-fg-dim sm:inline">{stateLabel}</span>
          </>
        )}
        {/* WCAG 2.2.2 — an auto-moving ticker on every page must be pausable */}
        <button
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
          aria-label={paused ? "Resume ticker scrolling" : "Pause ticker scrolling"}
          // The glyph is ~7px wide, so this cleared the tap floor's min-height
          // and still failed WCAG 2.2 AA 2.5.8 on WIDTH. Widened here rather
          // than in .tap-floor, whose comment explains that a global min-width
          // would force the dense terminal chips wider and wrap their rows.
          className="ml-1 inline-flex min-w-[24px] items-center justify-center text-fg-faint transition-colors hover:text-fg"
        >
          {paused ? "▶" : "⏸"}
        </button>
      </div>
      {/* The tape: a flex-1 track between the two pills. Fade masks at both
          edges so quotes dissolve into the pills instead of hard-clipping
          mid-glyph. */}
      <div
        className="min-w-0 flex-1 overflow-hidden"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
        }}
      >
        <div className="flex marquee gap-8 py-2">
          {items.length === 0 ? (
            <span className="flex items-center gap-2 whitespace-nowrap shrink-0 text-fg-faint">
              connecting to the live quote stream…
            </span>
          ) : (
            items.map((t, i) => {
              const sym = DISPLAY[t.sym] ?? t.sym;
              const up = t.chgPct >= 0;
              return (
                <span key={`${t.sym}-${i}`} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <span className="text-fg-dim">{sym}</span>
                  <span className="text-fg">{fmtPrice(t.last)}</span>
                  {/* The tape is AMBIENT, so it reads at 70%. Measured on
                      /trade: 62 of the 73 full-saturation green nodes on the
                      page were these percentages — the marquee duplicates its
                      content to loop, so every up-quote glowed two or three
                      times over. The result was that the loudest green on a
                      trading screen belonged to background chrome, while the
                      numbers a trade actually turns on used the same colour and
                      lost. Direction still reads; it just stops shouting. */}
                  <span className={up ? "text-bull/70" : "text-bear/70"}>{fmtPct(t.chgPct)}</span>
                  <span className="text-fg-faint">·</span>
                </span>
              );
            })
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-l border-border pl-4 pr-3">
        <span className="text-fg-dim tabular-nums">{clock || "--:--:--"}</span>
        <span className="text-fg-faint">UTC</span>
      </div>
    </div>
  );
}
