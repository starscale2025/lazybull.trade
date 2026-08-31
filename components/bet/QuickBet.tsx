"use client";

// The one-tap paper bet: UP or DOWN, a dollar stake, one button.
//
// Mounted on /quant and /trade/chain. Before you commit, the slip shows the
// read from both halves of the product — what the quant jury says and what the
// pricing models say. On /quant it runs on the SAME candles the page's bots
// just ran on (so slip and page always agree there); elsewhere it fetches its
// own daily bars.
//
// A bet books as shares on the SHARED paper account (lib/pro/paper.ts):
// UP = buy $stake of stock, DOWN = short $stake. Same cash, same realized
// P&L, same kill switch as every other page. Educational, paper only.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { modelRead, quantRead } from "@/lib/bet-analysis";
import { placePaperOrder } from "@/lib/pro/paper";
import { track } from "@/lib/track";
import { narrate } from "@/lib/narrator";
import { usePaper, useSafety, useStrategy } from "@/lib/stores";
import { unrealizedPnl } from "@/lib/paper-shares";
import { detect } from "@/lib/detector";
import type { Candle } from "@/lib/candles";
import { DockSlot } from "@/components/Dock";

type Props = {
  symbol: string;
  /** Live spot if the page already has one; falls back to the last close. */
  spot?: number;
  /** Daily bars if the page already fetched them; the slip fetches otherwise. */
  candles?: Candle[];
  /** When set, betting is locked and this explains why (e.g. seed tape —
      synthetic prices must never book into the real shared paper account). */
  lockReason?: string | null;
  /** Offered as the way out of the lock (e.g. switch the page to live mode). */
  onUnlock?: () => void;
};

const STAKES = [500, 1000, 5000] as const;

export function QuickBet({ symbol, spot, candles: candlesProp, lockReason, onUnlock }: Props) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  // Stake is held as TEXT while typing so a decimal point survives keystrokes;
  // `stake` is the parsed value everything else reads.
  const [stakeText, setStakeText] = useState("1000");
  const stake = Math.max(0, parseFloat(stakeText) || 0);
  const setStake = (n: number) => setStakeText(String(n));
  const [placed, setPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── bars: use the page's if given, else fetch daily bars once per symbol
  const [fetched, setFetched] = useState<Candle[] | null>(null);
  useEffect(() => {
    if (candlesProp?.length) return; // page supplies them
    let cancelled = false;
    setFetched(null);
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          // 180 to match the /quant workbench's default window — a different
          // bar count made the SAME symbol report opposite Hurst regimes on
          // /quant and /trade/chain at the same instant.
          setFetched(
            j.bars.slice(-180).map((b: { o: number; h: number; l: number; c: number }) => ({
              o: b.o, h: b.h, l: b.l, c: b.c,
            }))
          );
        }
      } catch {
        /* slip stays in its loading state */
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, candlesProp?.length]);

  const candles = candlesProp?.length ? candlesProp : fetched;
  const last = candles?.[candles.length - 1]?.c;
  const mark = Number.isFinite(spot) && (spot as number) > 0 ? (spot as number) : last;

  // ── the two reads (memoized: the jury is cheap but not free)
  const reads = useMemo(() => {
    if (!candles || candles.length < 30 || !Number.isFinite(mark)) return null;
    return {
      quant: quantRead(candles, symbol),
      model: modelRead(candles, mark as number, 30),
    };
  }, [candles, symbol, mark]);

  // ── context from the rest of the app
  const legs = useStrategy((s) => s.legs);
  const chainNote = useMemo(() => {
    if (!legs.length) return null;
    try {
      const d = detect(legs);
      return `${d.kind} · ${d.bias}${d.defined ? " · defined risk" : ""}`;
    } catch {
      return null;
    }
  }, [legs]);

  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const position = usePaper((s) => s.shares[symbol] ?? null);
  const killed = useSafety((s) => s.killSwitchTriggered);
  const livePnl = unrealizedPnl(position, mark ?? NaN);

  // Reset transient state when the slip closes or the symbol changes.
  const symRef = useRef(symbol);
  useEffect(() => {
    if (symRef.current !== symbol) {
      symRef.current = symbol;
      setPlaced(null);
      setError(null);
    }
  }, [symbol]);

  // Was rounded to 2dp, so a $2 stake on a $333 share booked 0.01 shares —
  // 24% over the advertised notional — and sub-$1.67 stakes rounded to 0 and
  // could not be booked at all. Keep full precision; the account is fractional.
  const qty = mark && stake > 0 ? stake / mark : 0;
  // UP spends cash, so it needs the stake available. DOWN is a short sale that
  // CREDITS cash in this no-margin model — but with NO ceiling one tap could
  // mint arbitrary cash and thereby defeat UP's own gate, so bound it by the
  // account's own size rather than leaving it open.
  const maxShort = Math.max(0, Math.max(cash, 0) + Math.max(startingCash, 0));
  const canPlace =
    !lockReason &&
    !killed &&
    !!mark &&
    qty > 0 &&
    Number.isFinite(stake) &&
    (dir === "down" ? stake <= maxShort : stake <= Math.max(0, cash));

  const place = () => {
    setError(null);
    if (!mark) return;
    // Defense in depth: the lock hides this button, but nothing else may book
    // a synthetic-price fill into the shared account either.
    if (lockReason) {
      setError(lockReason);
      return;
    }
    if (killed) {
      setError("Kill switch is on — no new bets until it resets.");
      return;
    }
    // UP = buy, DOWN = short. Both book through the shared-account funnel.
    const res = placePaperOrder({ sym: symbol, side: dir === "up" ? "buy" : "sell", type: "market", qty, price: mark });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // The analysis shown at decision time is data gold: did people bet WITH
    // the jury or against it, and how did that go?
    track("bet_placed", {
      sym: symbol,
      dir,
      stake,
      jury_lean: reads?.quant.lean ?? null,
      jury_conf: reads?.quant.confidence ?? null,
      model_p_up: reads?.model.pUp ?? null,
    });
    narrate(`Bet placed — ${dir} $${stake.toLocaleString()} on ${symbol} at ${mark.toFixed(2)}.`);
    setPlaced(`${dir === "up" ? "▲ UP" : "▼ DOWN"} $${stake.toLocaleString()} on ${symbol} @ ${mark.toFixed(2)}`);
  };

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <DockSlot order={20}>
    <div className="flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-[20rem] border border-border bg-bg shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg">
                Bet on <span className="text-bull">{symbol}</span>
                <span className="ml-2 t-data text-fg-dim">{mark ? `$${mark.toFixed(2)}` : "…"}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close position slip"
                className="font-mono text-xs text-fg-faint hover:text-fg"
              >
                ✕
              </button>
            </div>

            {lockReason ? (
              <div className="space-y-3 p-4">
                <div className="border border-amber/40 bg-amber/10 px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-amber">
                  ⚠ betting locked — {lockReason}
                </div>
                <div className="t-chrome text-fg-faint">
                  bets book on your real paper account, so they only fill at real prices
                </div>
                {onUnlock && (
                  <button
                    onClick={onUnlock}
                    className="w-full border border-bull bg-bull/10 py-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bull transition-colors hover:bg-bull hover:text-bg"
                  >
                    switch to live data
                  </button>
                )}
              </div>
            ) : placed ? (
              <div className="space-y-3 p-4">
                <div className="border border-bull/40 bg-bull/10 px-3 py-2 font-mono text-[0.6875rem] text-bull">
                  ✓ Paper bet placed — {placed}
                </div>
                <div className="t-chrome text-fg-faint">
                  cash ${Math.round(cash).toLocaleString()} · manage it on the PRO chart
                </div>
                <button
                  onClick={() => setPlaced(null)}
                  className="w-full border border-border py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim hover:text-fg"
                >
                  Place another
                </button>
              </div>
            ) : (
              <>
                {/* direction — the whole bet in two buttons */}
                <div className="grid grid-cols-2 gap-px bg-border p-px">
                  <button
                    onClick={() => setDir("up")}
                    aria-pressed={dir === "up"}
                    className={`py-3 font-mono text-sm font-semibold uppercase tracking-wider transition-colors ${
                      dir === "up" ? "bg-bull text-bg" : "bg-bg text-fg-dim hover:text-fg"
                    }`}
                  >
                    ▲ Up
                  </button>
                  <button
                    onClick={() => setDir("down")}
                    aria-pressed={dir === "down"}
                    className={`py-3 font-mono text-sm font-semibold uppercase tracking-wider transition-colors ${
                      dir === "down" ? "bg-bear text-bg" : "bg-bg text-fg-dim hover:text-fg"
                    }`}
                  >
                    ▼ Down
                  </button>
                </div>

                {/* stake */}
                <div className="flex items-center gap-1.5 px-3 pt-3">
                  {STAKES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStake(s)}
                      aria-pressed={stake === s}
                      className={`flex-1 border py-1.5 font-mono text-[0.6875rem] tabular-nums transition-colors ${
                        stake === s ? "border-bull/60 bg-bull/10 text-bull" : "border-border text-fg-dim hover:text-fg"
                      }`}
                    >
                      ${s >= 1000 ? `${s / 1000}k` : s}
                    </button>
                  ))}
                  <div className="flex items-center border border-border px-2 py-1.5">
                    <span className="mr-1 font-mono text-[0.6875rem] text-fg-faint">$</span>
                    <input
                      value={stake}
                      // Math.round() on every keystroke deleted the decimal
                      // point mid-typing: "10.5" became 105 — a 10x bet. Keep
                      // the raw string while editing and parse on use.
                      onChange={(e) => setStakeText(e.target.value.replace(/[^\d.]/g, ""))}
                      aria-label="Custom stake in dollars"
                      className="w-14 bg-transparent text-right font-mono text-[0.6875rem] tabular-nums text-fg outline-none"
                    />
                  </div>
                </div>

                {/* the two reads */}
                <div className="space-y-2 px-3 py-3">
                  <div className="border border-border-soft bg-surface px-2.5 py-2">
                    <div className="font-mono text-[0.625rem] uppercase tracking-widest text-fg-faint">what the quants say</div>
                    {reads ? (
                      <div className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
                        <span className={reads.quant.lean === "UP" ? "text-bull" : reads.quant.lean === "DOWN" ? "text-bear" : "text-fg"}>
                          {reads.quant.lean === "NEUTRAL"
                            ? "jury is split"
                            : `${Math.max(reads.quant.up, reads.quant.down)}/${reads.quant.jurySize} bots lean ${reads.quant.lean}`}
                        </span>
                        {reads.quant.lean !== "NEUTRAL" && <> · conf {pct(reads.quant.confidence)}</>}
                        <br />
                        {reads.quant.regime.toLowerCase()} regime · H {reads.quant.h.toFixed(2)}
                      </div>
                    ) : (
                      <div className="mt-1 font-mono text-[0.6875rem] text-fg-faint">reading the tape…</div>
                    )}
                  </div>
                  <div className="border border-border-soft bg-surface px-2.5 py-2">
                    <div className="font-mono text-[0.625rem] uppercase tracking-widest text-fg-faint">what the models say</div>
                    {reads ? (
                      <div className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
                        <span className={reads.model.pUp >= 0.5 ? "text-bull" : "text-bear"}>
                          {pct(reads.model.pUp)} chance above ${(mark as number).toFixed(0)}
                        </span>{" "}
                        in {reads.model.days}d
                        <br />
                        vol {pct(reads.model.vol)} · 1σ ${reads.model.lo.toFixed(0)}–${reads.model.hi.toFixed(0)}
                      </div>
                    ) : (
                      <div className="mt-1 font-mono text-[0.6875rem] text-fg-faint">pricing the range…</div>
                    )}
                  </div>
                  {chainNote && (
                    <div className="border border-border-soft bg-surface px-2.5 py-2">
                      <div className="font-mono text-[0.625rem] uppercase tracking-widest text-fg-faint">on your chain</div>
                      <div className="mt-1 font-mono text-[0.6875rem] text-fg-dim">{chainNote}</div>
                    </div>
                  )}
                  {position && position.qty !== 0 && (
                    <div className="font-mono text-[0.625rem] text-fg-faint">
                      already {position.qty > 0 ? "long" : "short"} {Math.abs(position.qty)} @ {position.avgPrice.toFixed(2)} (
                      <span className={livePnl >= 0 ? "text-bull" : "text-bear"}>
                        {livePnl >= 0 ? "+" : "−"}${Math.abs(livePnl).toFixed(0)}
                      </span>
                      )
                    </div>
                  )}
                </div>

                {/* place */}
                <div className="px-3 pb-3">
                  <button
                    onClick={place}
                    disabled={!canPlace}
                    className={`w-full py-2.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${
                      dir === "up" ? "bg-bull text-bg hover:bg-bull-dim" : "bg-bear text-bg hover:bg-bear-dim"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {killed ? "kill switch on" : `Place $${stake.toLocaleString()} ${dir === "up" ? "▲ up" : "▼ down"} bet`}
                  </button>
                  {error && (
                    <div role="alert" className="mt-2 border border-bear/40 bg-bear/10 px-2 py-1.5 font-mono text-[0.625rem] text-bear">
                      {error}
                    </div>
                  )}
                  <div className="mt-2 text-center font-mono text-[0.625rem] uppercase tracking-widest text-fg-faint">
                    paper only · ${Math.round(cash).toLocaleString()} cash · not advice
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pointer-events-auto flex items-center gap-2 border border-bull/50 bg-bg/90 px-4 py-2.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bull shadow-xl backdrop-blur transition-colors hover:bg-bull hover:text-bg"
      >
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        {open ? "Hide" : "Paper trade"}
      </button>
    </div>
    </DockSlot>
  );
}
