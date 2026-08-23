"use client";

/**
 * THE DECIMATION — the run ritual (design system: ui_kits/decimation).
 *
 * The workspace already decimates per bot: each BotCell streams a log, then
 * scrambles its own metrics into place. What it never had was a WORKSPACE-
 * level moment — the beat where the whole desk commits. This is that beat,
 * in four acts:
 *
 *   idle       "Run the tape." over 10px chrome; metrics read "—" until earned
 *   lockdown   amber hazard strip, inputs frozen, the phosphor rail ignites
 *   streaming  the run log types; one tally cell arms per bot that lands
 *   verdict    the four consensus figures scramble once and resolve; the
 *              headline rewrites to the aggregate side, counts matching
 *
 * EVERY NUMBER HERE IS REAL. The kit is a static preview and hard-codes its
 * outcome (19 buy · 4 hold · 4 sell, 74% confidence, +18.4% CAGR). Shipping
 * those literals would put invented performance figures on a page whose whole
 * argument is that it tells you what is real — so the tally counts actual
 * verdicts, confidence is the mean of the bots' own confidences, drawdown is
 * computed from the equity curves that bots actually returned (and reads "—"
 * when none did), and runtime is measured, not asserted.
 */

import { useEffect, useRef, useState } from "react";
import { DecimatedNumber } from "./DecimatedNumber";
import type { ActiveBot, BotDef, BotResult, Verdict } from "@/lib/quant/types";

export type RunPhase = "idle" | "lockdown" | "streaming" | "decimating" | "verdict";

type Row = { active: ActiveBot; def: BotDef; result: BotResult | null };

const LOG = [
  "▸ workspace lock acquired · inputs frozen",
  "▸ loading tape",
  "▸ staging bots · in-process",
  "▸ walk-forward · no lookahead",
  "▸ verdict committed · lock released",
];

/** Max peak-to-trough decline across every equity curve a bot returned. */
function worstDrawdown(rows: Row[]): number | null {
  let worst: number | null = null;
  for (const r of rows) {
    const eq = r.result?.equity;
    if (!eq || eq.length < 6) continue;
    let peak = eq[0];
    let dd = 0;
    for (const v of eq) {
      if (v > peak) peak = v;
      // Curves are relative pnl; guard a zero/negative peak so a flat start
      // can't divide us into Infinity.
      if (peak > 0) dd = Math.min(dd, (v - peak) / peak);
    }
    worst = worst === null ? dd : Math.min(worst, dd);
  }
  return worst;
}

function sideColor(side: Verdict["side"]) {
  return side === "buy"
    ? "var(--bull)"
    : side === "sell"
      ? "var(--bear)"
      : side === "warn"
        ? "var(--amber)"
        : "var(--fg-faint)";
}

/** The phosphor glow behind the verdict, in that verdict's own colour — a
    green halo behind a red "sell." would say the opposite of the word. */
function sideGlow(side: Verdict["side"]) {
  const rgb =
    side === "buy"
      ? "0, 255, 135"
      : side === "sell"
        ? "255, 46, 99"
        : side === "warn"
          ? "255, 184, 0"
          : "138, 138, 130";
  return `0 0 30px rgba(${rgb}, 0.45), 0 0 80px rgba(${rgb}, 0.2)`;
}

export function RunRitual({
  phase,
  rows,
  symbol,
  bars,
  dataSource,
  runMs,
  onRunAll,
}: {
  phase: RunPhase;
  rows: Row[];
  symbol: string;
  bars: number;
  dataSource: "live" | "seed" | "fallback";
  /** Measured wall-clock of the last completed run, in ms. */
  runMs: number | null;
  onRunAll: () => void;
}) {
  const total = rows.length;
  const done = rows.filter((r) => r.result);
  const armed = done.length;

  const counts = { buy: 0, sell: 0, hold: 0, warn: 0 };
  for (const r of done) counts[r.result!.verdict.side]++;

  const score = (counts.buy - counts.sell) / Math.max(1, done.length);
  const aggregate: Verdict["side"] =
    score > 0.25
      ? "buy"
      : score < -0.25
        ? "sell"
        : counts.warn > 0 && counts.buy === 0
          ? "warn"
          : "hold";

  const confidences = done
    .map((r) => r.result!.verdict.confidence)
    .filter((c): c is number => typeof c === "number");
  const meanConf = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  // How much the bots agree = the largest bloc, NOT the votes for `aggregate`.
  // Those differ: 2 buy / 1 hold / 1 sell scores 0.25, which fails the >0.25
  // threshold and aggregates to "hold" — so reading agreement off the
  // aggregate would print "1/4" next to a tally whose biggest column is 2.
  // The largest bloc is what "agreement" means to a reader, and it can never
  // contradict the tally sitting directly above it.
  const largestBloc = Math.max(counts.buy, counts.sell, counts.hold, counts.warn);

  const dd = worstDrawdown(done);

  const locked = phase === "lockdown" || phase === "streaming" || phase === "decimating";
  const settled = phase === "verdict";

  // The run log types out while the machine holds the lock. Lines are paced
  // by the ritual, not by the bots — but the last line only lands when the
  // lock actually releases, so the log can never claim a verdict early.
  const [lines, setLines] = useState(0);
  useEffect(() => {
    // "lockdown" resets as well as "idle": a re-run goes verdict → lockdown
    // and never passes through idle, so resetting only on idle left the log
    // showing "verdict committed · lock released" from the PREVIOUS run while
    // the new one was still at 0 bots — the log claiming a result the machine
    // had not produced.
    if (phase === "idle" || phase === "lockdown") {
      setLines(0);
      return;
    }
    if (settled) {
      setLines(LOG.length);
      return;
    }
    // Stop one short: the final line is the lock releasing, and only the
    // verdict phase is allowed to print it.
    if (lines >= LOG.length - 1) return;
    const t = setTimeout(() => setLines((l) => l + 1), 380);
    return () => clearTimeout(t);
  }, [phase, lines, settled]);

  // "— until earned". A consensus figure is only meaningful once every staged
  // bot has landed: at 2 of 4 in, a mean confidence is a real number computed
  // over half the evidence, and set in 30px tabular mono it reads as the
  // answer. So the figures stay "—" for the whole run and arrive with the
  // decimation, which is what that beat is FOR.
  const revealed = phase === "decimating" || phase === "verdict";

  const METRICS: { label: string; value: string; tone: "bull" | "bear" | "fg" }[] = [
    {
      label: "mean confidence",
      value: meanConf === null ? "—" : `${Math.round(meanConf * 100)}%`,
      tone: "bull",
    },
    {
      label: "agreement",
      value: done.length === 0 ? "—" : `${largestBloc}/${done.length}`,
      tone: aggregate === "sell" ? "bear" : "bull",
    },
    {
      label: "worst drawdown",
      value: dd === null ? "—" : `−${Math.abs(dd * 100).toFixed(1)}%`,
      tone: "bear",
    },
    {
      label: "runtime",
      value: runMs === null ? "—" : `${(runMs / 1000).toFixed(1)}s`,
      tone: "fg",
    },
  ];

  const tapeLabel =
    dataSource === "live"
      ? `${symbol} · D · ${bars}d live tape`
      : dataSource === "fallback"
        ? `${symbol} · D · ${bars}d fallback tape`
        : `${symbol} · D · ${bars}d seed tape`;

  return (
    <section
      aria-label="Run the workbench"
      className="relative mx-auto mt-4 w-full max-w-[1500px] px-5"
    >
      <div className="surface-card relative overflow-hidden border border-border bg-bg">
        {/* one background texture — the fine grid, masked. No orbs, no noise. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid-fine"
          style={{
            maskImage: "radial-gradient(75% 65% at 50% 42%, #000 20%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(75% 65% at 50% 42%, #000 20%, transparent 100%)",
          }}
        />

        {/* ── chrome strip — the whisper altitude ─────────────────────────── */}
        <div className="relative flex flex-wrap items-center gap-3 border-b border-border bg-bg-soft px-4 py-2.5">
          <span className="relative inline-flex size-5 shrink-0 items-center justify-center border border-fg/40">
            <span aria-hidden className="absolute inset-0.5 bg-bull" />
            <span className="relative font-mono text-[7px] font-bold text-bg">LB</span>
          </span>
          <span className="t-chrome text-fg">consensus engine</span>
          <span className="t-chrome text-fg-faint">{tapeLabel}</span>
          {dataSource !== "live" && (
            <span className="flex items-center gap-1.5 t-chrome text-amber">
              <span aria-hidden className="size-1.5 rounded-full bg-amber" /> SIM
            </span>
          )}
          <div className="flex-1" />
          <span className={`t-data text-[10px] ${locked ? "text-bull" : "text-fg-faint"}`}>
            {armed}/{total}
          </span>
          <button
            onClick={onRunAll}
            disabled={locked || total === 0}
            className={`inline-flex h-7 items-center gap-2 border px-3 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              locked || total === 0
                ? "cursor-not-allowed border-border text-fg-faint"
                : "border-bull bg-bull/10 text-bull hover:bg-bull hover:text-bg"
            }`}
          >
            {!locked && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
            {phase === "idle" ? `run all (${total})` : settled ? "↻ run again" : "running…"}
          </button>
        </div>

        {/* the phosphor rail — the machine's pulse while it holds the lock */}
        {locked ? <div className="dc-rail relative" /> : <div className="h-0.5" />}

        {/* ── the lockdown notice ─────────────────────────────────────────── */}
        {locked && (
          <div className="dc-line relative flex items-stretch border-b border-amber/30 bg-amber/6">
            <span aria-hidden className="dc-hazard w-1.5 shrink-0" />
            <span className="t-chrome px-3 py-1.5 text-amber">
              workspace locked · run in progress · inputs frozen
            </span>
          </div>
        )}

        {/* ── the monument ────────────────────────────────────────────────── */}
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_380px] lg:items-center lg:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 t-eyebrow text-fg-faint">
              <span aria-hidden className="text-bull">
                ⟢
              </span>
              <span className="whitespace-nowrap">the workbench</span>
            </div>

            {settled ? (
              <h2
                className="dc-verdict mt-1.5 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.87] tracking-[-0.05em]"
                style={{
                  color: sideColor(aggregate),
                  textShadow: sideGlow(aggregate),
                }}
              >
                {aggregate}
                <span className="crt-flicker">.</span>
              </h2>
            ) : (
              <h2
                className="mt-1.5 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.87] tracking-[-0.05em] text-fg transition-opacity duration-400 [transition-timing-function:var(--ease-settle)]"
                style={{ opacity: locked ? 0.35 : 1 }}
              >
                Run the <span className="t-accent">tape</span>
                <span className="text-bull">.</span>
              </h2>
            )}

            <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 t-chrome text-fg-faint">
              {settled ? (
                <>
                  <span className="text-bull">{counts.buy} buy</span>
                  <span>·</span>
                  <span>{counts.hold} hold</span>
                  <span>·</span>
                  <span className="text-bear">{counts.sell} sell</span>
                  {counts.warn > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber">{counts.warn} warn</span>
                    </>
                  )}
                </>
              ) : (
                <span>{total} staged</span>
              )}
              <span>·</span>
              <span>walk-forward · no lookahead</span>
              <span>·</span>
              {/* The provenance must name the SAME tape the chrome strip
                  named — a header reading "fallback tape" over a line reading
                  "seed tape" is exactly the contradiction the SIM lamp exists
                  to prevent. */}
              <span className="text-amber">
                {dataSource === "live"
                  ? "live tape · not advice"
                  : dataSource === "fallback"
                    ? "fallback tape · not advice"
                    : "seed tape · not advice"}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-11 gap-y-7">
              {METRICS.map((m) => (
                <div key={m.label}>
                  <div className="t-chrome text-fg-faint">{m.label}</div>
                  <div
                    className={`t-data mt-1 text-[30px] tracking-[-0.02em] ${
                      m.tone === "bull"
                        ? "text-bull"
                        : m.tone === "bear"
                          ? "text-bear"
                          : "text-fg"
                    }`}
                  >
                    {!revealed || m.value === "—" ? (
                      <span className="text-fg-faint">—</span>
                    ) : (
                      <DecimatedNumber
                        value={m.value}
                        active={phase === "decimating"}
                        duration={700}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── the run stream — an instrument, not a card ─────────────────── */}
          <div className="relative self-center surface-instrument border border-border bg-surface">
            {locked && <div className="dc-rail absolute inset-x-0 top-0" />}
            <div
              className={`flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 t-eyebrow ${
                locked ? "text-bull" : "text-fg-dim"
              }`}
            >
              <span>run stream</span>
              <span className="t-chrome text-fg-faint">
                {armed}/{total}
              </span>
            </div>

            <div className="min-h-[138px] px-3.5 py-3 font-mono text-[11px] leading-[1.7] text-fg-dim">
              {phase === "idle" ? (
                <span className="text-fg-faint">
                  ▸ {total} bots staged · the workspace locks while the machine runs
                </span>
              ) : (
                LOG.slice(0, lines).map((l, i) => (
                  <div
                    key={l}
                    className="dc-line"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span
                      className={
                        i === LOG.length - 1
                          ? "text-bull"
                          : i === 0
                            ? "text-amber"
                            : "text-fg-dim"
                      }
                    >
                      {l}
                    </span>
                  </div>
                ))
              )}
              {locked && <span className="blink text-bull">▌</span>}
            </div>

            {/* one cell per staged bot, armed in the order they land and
                coloured by that bot's own verdict */}
            <div className="grid grid-cols-9 gap-[3px] px-3.5 pb-3.5">
              {rows.map((r) => {
                const v = r.result?.verdict.side;
                const c = v ? sideColor(v) : null;
                return (
                  <div
                    key={r.active.uid}
                    className={c ? "dc-cell" : undefined}
                    title={`${r.def.name}${v ? ` · ${v}` : " · pending"}`}
                    style={{
                      height: 20,
                      border: `1px solid ${
                        c ? `color-mix(in srgb, ${c} 40%, transparent)` : "var(--border-soft)"
                      }`,
                      background: c ? `color-mix(in srgb, ${c} 12%, transparent)` : "transparent",
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-bg-soft px-3 py-1.5 t-chrome text-fg-faint">
              <span>
                <span className="text-bull">{counts.buy} buy</span> · {counts.hold} hold ·{" "}
                <span className="text-bear">{counts.sell} sell</span>
              </span>
              <span>in-process</span>
            </div>
          </div>
        </div>

        {/* ── the standing disclaimer — on screen at all times ─────────────── */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg-soft px-4 py-2">
          <span className="flex gap-3 t-chrome text-fg-faint">
            <span className={settled ? "text-bull" : locked ? "text-amber" : "text-fg-dim"}>
              ● {settled ? "lock released" : locked ? "lockdown" : "standing by"}
            </span>
          </span>
          <span className="t-chrome text-fg-faint">
            backtests are teaching instruments, not track records · never investment advice
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Drives the four acts around whatever `runAll` actually does.
 *
 * Deliberately NOT a timer that guesses when the run is over: `begin()` opens
 * the lock, the caller reports progress, and the ritual only reaches `verdict`
 * once every staged bot has landed. A run that stalls stays visibly locked
 * rather than flashing a verdict it does not have.
 */
export function useRunRitual(completedCount: number, stagedCount: number) {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [runMs, setRunMs] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);

  const begin = () => {
    startedAt.current = Date.now();
    setRunMs(null);
    setPhase("lockdown");
  };

  // lockdown → streaming: a 700ms beat so the hazard strip and the rail are
  // seen before the log starts moving.
  useEffect(() => {
    if (phase !== "lockdown") return;
    const t = setTimeout(() => setPhase("streaming"), 700);
    return () => clearTimeout(t);
  }, [phase]);

  // streaming → decimating, the moment the last staged bot lands.
  useEffect(() => {
    if (phase !== "streaming") return;
    if (stagedCount === 0 || completedCount < stagedCount) return;
    if (startedAt.current !== null) setRunMs(Date.now() - startedAt.current);
    const t = setTimeout(() => setPhase("decimating"), 250);
    return () => clearTimeout(t);
  }, [phase, completedCount, stagedCount]);

  // decimating → verdict, after the scramble resolves (~700ms).
  useEffect(() => {
    if (phase !== "decimating") return;
    const t = setTimeout(() => setPhase("verdict"), 750);
    return () => clearTimeout(t);
  }, [phase]);

  const reset = () => {
    startedAt.current = null;
    setRunMs(null);
    setPhase("idle");
  };

  return { phase, runMs, begin, reset };
}
