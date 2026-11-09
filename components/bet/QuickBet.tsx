"use client";

// The one-tap paper trade: UP or DOWN, a dollar amount, one button.
//
// Mounted on /quant and /trade/chain. It is an order ticket and nothing else.
// It used to print "what the quants say" (N/6 bots lean UP · conf) and "what
// the models say" (the odds of closing above $X in 30d) for the named stock, on today's
// tape, directly above the UP/DOWN buttons: a stock-specific, forward-looking
// read beside a trade button, which docs/COMPLIANCE.md (b)3 rules out (Gate A
// re-tribunal, 2026-11-05). The models' reads live on /quant, on a window
// that has already played out (lib/quant/reads). The bars below only supply
// the mark when the page does not pass a spot.
//
// A bet books as shares on the SHARED paper account (lib/pro/paper.ts):
// UP = buy $stake of stock, DOWN = short $stake. Same cash, same realized
// P&L, same kill switch as every other page. Educational, paper only.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  /** When set, trading is locked and this explains why (e.g. seed tape —
      synthetic prices must never book into the real shared paper account). */
  lockReason?: string | null;
  /** Offered as the way out of the lock (e.g. switch the page to live mode). */
  onUnlock?: () => void;
  /** Render in the page's own flow instead of the floating dock. /quant puts
      the ticket in its Output panel's footer: floating, it sat over the
      panel's "what the tape did next" line (Gate A re-run, d35). */
  inline?: boolean;
};

const STAKES = [500, 1000, 5000] as const;

export function QuickBet({ symbol, spot, candles: candlesProp, lockReason, onUnlock, inline = false }: Props) {
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
    track("bet_placed", { sym: symbol, dir, stake });
    narrate(`Paper trade placed — ${dir} $${stake.toLocaleString()} on ${symbol} at ${mark.toFixed(2)}.`);
    setPlaced(`${dir === "up" ? "▲ UP" : "▼ DOWN"} $${stake.toLocaleString()} on ${symbol} @ ${mark.toFixed(2)}`);
  };

  const ticket = (
    <div className={`flex flex-col gap-2 ${inline ? "" : "items-end"}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto surface-instrument border border-border bg-bg ${inline ? "w-full" : "w-[20rem] shadow-2xl"}`}
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-[0.8125rem] font-medium text-fg">
                Paper trade on <span className="text-brand-ink">{symbol}</span>
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
                <div className="rounded-[var(--r-instrument)] bg-amber/10 px-3 py-2 text-[0.8125rem] leading-relaxed text-amber">
                  Trading locked — {lockReason}
                </div>
                <div className="t-label text-fg-faint">
                  Paper trades book on your real paper account, so they only fill at real prices
                </div>
                {onUnlock && (
                  <button
                    onClick={onUnlock}
                    className="tool-btn tool-btn-primary w-full"
                  >
                    Switch to live data
                  </button>
                )}
              </div>
            ) : placed ? (
              <div className="space-y-3 p-4">
                <div className="rounded-[var(--r-instrument)] bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] px-3 py-2 text-[0.8125rem] text-fg">
                  Paper trade placed — {placed}
                </div>
                <div className="t-label text-fg-faint">
                  Cash ${Math.round(cash).toLocaleString()} · manage it on the Pro chart
                </div>
                <button
                  onClick={() => setPlaced(null)}
                  className="tool-btn w-full"
                >
                  Place another
                </button>
              </div>
            ) : (
              <>
                {/* direction — the whole bet in two buttons */}
                <div className="grid grid-cols-2 gap-1.5 px-3 pt-3">
                  <button
                    onClick={() => setDir("up")}
                    aria-pressed={dir === "up"}
                    className={`rounded-[var(--r-instrument)] py-2.5 text-sm font-semibold transition-colors ${
                      dir === "up" ? "bg-bull text-bg" : "bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] text-fg-dim hover:text-fg"
                    }`}
                  >
                    ▲ Up
                  </button>
                  <button
                    onClick={() => setDir("down")}
                    aria-pressed={dir === "down"}
                    className={`rounded-[var(--r-instrument)] py-2.5 text-sm font-semibold transition-colors ${
                      dir === "down" ? "bg-bear text-bg" : "bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] text-fg-dim hover:text-fg"
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
                      className={`flex-1 rounded-[var(--r-instrument)] py-1.5 font-mono text-[0.6875rem] tabular-nums transition-colors ${
                        stake === s ? "bg-fg text-bg" : "bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] text-fg-dim hover:text-fg"
                      }`}
                    >
                      ${s >= 1000 ? `${s / 1000}k` : s}
                    </button>
                  ))}
                  <div className="flex items-center rounded-[var(--r-instrument)] bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] px-2 py-1.5">
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

                {/* No model read here: see the header comment. */}
                <div className="space-y-2 px-3 py-3">
                  {chainNote && (
                    <div className="rounded-[var(--r-instrument)] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] px-2.5 py-2">
                      <div className="t-label text-fg-faint">On your chain</div>
                      <div className="mt-1 text-[0.75rem] text-fg-dim">{chainNote}</div>
                    </div>
                  )}
                  {position && position.qty !== 0 && (
                    <div className="t-label text-fg-faint">
                      Already {position.qty > 0 ? "long" : "short"} {Math.abs(position.qty)} @ {position.avgPrice.toFixed(2)} (
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
                    className={`w-full rounded-[var(--r-instrument)] py-2.5 text-[0.8125rem] font-semibold transition-colors ${
                      dir === "up" ? "bg-bull text-bg hover:bg-bull-dim" : "bg-bear text-bg hover:bg-bear-dim"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {killed ? "Kill switch on" : `Place $${stake.toLocaleString()} ${dir === "up" ? "▲ up" : "▼ down"} paper trade`}
                  </button>
                  {error && (
                    <div role="alert" className="mt-2 rounded-[var(--r-instrument)] bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] px-2 py-1.5 t-label text-fg">
                      {error}
                    </div>
                  )}
                  <div className="mt-2 text-center t-label text-fg-faint">
                    Paper only · ${Math.round(cash).toLocaleString()} cash · not advice
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
        className={`tool-btn pointer-events-auto ${inline ? "w-full" : "shadow-xl backdrop-blur"}`}
      >
        {/* Docked under the reads, it says which price it trades at: today's,
            not the window's the reads are about. */}
        {open ? "Hide" : inline ? "Paper trade · today's price" : "Paper trade"}
      </button>
    </div>
  );

  return inline ? ticket : <DockSlot order={20}>{ticket}</DockSlot>;
}
