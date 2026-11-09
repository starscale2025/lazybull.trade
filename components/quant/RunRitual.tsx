"use client";

/**
 * THE DECIMATION — the run ritual (design system: ui_kits/decimation).
 *
 * The workspace already decimates per bot: each BotCell streams a log, then
 * scrambles its own metrics into place. What it never had was a WORKSPACE-
 * level moment — the beat where the whole desk commits. This is that beat,
 * in four acts:
 *
 *   idle       "Run the tape." over its status strip; metrics read "—" until earned
 *   lockdown   the lock notice, inputs frozen, the rail ignites
 *   streaming  the run log types; one tally cell arms per bot that lands
 *   verdict    the consensus figures scramble once and resolve; the
 *              headline rewrites to the aggregate side, counts matching
 *
 * EVERY NUMBER HERE IS REAL. The kit is a static preview and hard-codes its
 * outcome (19 buy · 4 hold · 4 sell, 74% confidence, +18.4% CAGR). Shipping
 * those literals would put invented performance figures on a page whose whole
 * argument is that it tells you what is real — so the tally counts actual
 * verdicts, agreement is the largest bloc of them, drawdown is computed from
 * the equity curves that bots actually returned (and reads "—" when none
 * did), and runtime is measured, not asserted.
 *
 * There is no confidence figure (Gate A3, 2026-11). "Mean confidence" was the
 * mean of the bots' verdict.confidence, real arithmetic over numbers that are
 * not odds: each bot scales its own signal into 0-1, and the consensus card
 * mapped its agreement tier to 95%. Set in 30px mono over a hit-rate band, it
 * read as the chance the read was right.
 */

import { Fragment, useEffect, useRef, useState } from "react";
import { Chip, ToolButton } from "@/components/calm/kit";
import { BullMark } from "@/components/BullMark";
import { DecimatedNumber } from "./DecimatedNumber";
import { sentence } from "./sentence";
import type { ActiveBot, BotDef, BotResult, Verdict } from "@/lib/quant/types";
import { AGGREGATE_READ, HOLDOUT, READ } from "@/lib/quant/reads";

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

/** The headline's type, shared by the live <h2> and the spacers that hold
    its height (see the monument). */
const HEADLINE = "font-display text-[clamp(3rem,8vw,6rem)] leading-[0.87] tracking-[-0.05em]";

function RunTheTape() {
  return (
    <>
      Run the <span className="t-accent">tape</span>.
    </>
  );
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

  // Q4: the OutputPanel is the standing home of the aggregate — a few seconds
  // after the verdict lands, this band folds to a slim strip so three copies
  // of the same numbers don't compete. Unfolding remounts the monument, which
  // replays the settle animation. A new run always unfolds.
  //
  // It folds only while the band is OFF screen (2026-11, Gate A2 CLS). On a
  // timer it folded under the reader's eyes ~6.4s after load and shoved
  // everything below it up: 0.05 of /quant's layout shift. Off screen, a band
  // below the viewport changes nothing visible, and one above it is held in
  // place by scroll anchoring. If it is on screen when the 4s are up, it
  // waits for the reader to scroll it away.
  const [folded, setFolded] = useState(false);
  const bandRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!settled) {
      setFolded(false);
      return;
    }
    let due = false;
    let visible = true;
    const fold = () => {
      if (due && !visible) setFolded(true);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      fold();
    });
    if (bandRef.current) io.observe(bandRef.current);
    const t = setTimeout(() => {
      due = true;
      fold();
    }, 4000);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [settled]);

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
  // bot has landed: at 2 of 4 in, an agreement count is a real number computed
  // over half the evidence, and set in 30px tabular mono it reads as the
  // answer. So the figures stay "—" for the whole run and arrive with the
  // decimation, which is what that beat is FOR.
  const revealed = phase === "decimating" || phase === "verdict";

  const METRICS: { label: string; value: string; tone: "bull" | "bear" | "fg" }[] = [
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
      ? `${symbol} · D · ${bars}d live tape, ending ${HOLDOUT} sessions back`
      : dataSource === "fallback"
        ? `${symbol} · D · ${bars}d fallback tape, ending ${HOLDOUT} sessions back`
        : `${symbol} · D · ${bars}d seed tape, ending ${HOLDOUT} sessions back`;

  if (settled && folded) {
    return (
      <section aria-label="Run the workbench" className="shell shell-wide relative mt-4">
        <div className="surface-instrument flex flex-wrap items-center gap-3 border border-border bg-surface px-4 py-2.5">
          <BullMark className="h-4 w-6 shrink-0" />
          <span className="t-label text-fg">Consensus engine</span>
          <span
            className="font-display text-lg leading-none tracking-tightest"
            style={{ color: sideColor(aggregate) }}
          >
            {sentence(AGGREGATE_READ[aggregate])}.
          </span>
          <span className="t-label text-fg-faint">
            <span className="text-bull">{counts.buy} {READ.buy}</span> · {counts.hold} {READ.hold} ·{" "}
            <span className="text-bear">{counts.sell} {READ.sell}</span>
            {counts.warn > 0 && (
              <>
                {" · "}
                <span className="text-amber">{counts.warn} {READ.warn}</span>
              </>
            )}
          </span>
          <span className="t-label hidden text-fg-faint sm:inline">{tapeLabel}</span>
          <div className="flex-1" />
          <button
            onClick={() => setFolded(false)}
            className="t-label text-fg-faint transition-colors hover:text-fg"
          >
            ↻ Replay ritual
          </button>
          <ToolButton onClick={onRunAll} disabled={total === 0}>
            ↻ Run again
          </ToolButton>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={bandRef}
      aria-label="Run the workbench"
      className="shell shell-wide relative mt-4"
    >
      <div className="surface-instrument border border-border bg-surface">
        {/* ── status strip ────────────────────────────────────────────────── */}
        <div className="relative flex flex-wrap items-center gap-3 rounded-t-[inherit] border-b border-border bg-bg-soft px-4 py-2.5">
          <BullMark className="h-4 w-6 shrink-0" />
          <span className="t-label text-fg">Consensus engine</span>
          <span className="t-label text-fg-faint">{tapeLabel}</span>
          {dataSource !== "live" && (
            <Chip tone="warn" dot>
              SIM
            </Chip>
          )}
          <div className="flex-1" />
          {/* Both held at their widest state (2026-11-06). The label goes
              run all (N) → running… → ↻ run again, and at its natural width
              the button, and this count beside it, slid 39px along the strip
              at every change. */}
          <span className={`t-data min-w-[5ch] text-right text-[0.625rem] ${locked ? "text-brand-ink" : "text-fg-faint"}`}>
            {armed}/{total}
          </span>
          {/* Not `primary`: the page's one gradient is the same action in the hero. */}
          <ToolButton onClick={onRunAll} disabled={locked || total === 0} className="min-w-[8.5rem]">
            {phase === "idle" ? `Run all (${total})` : settled ? "↻ Run again" : "Running…"}
          </ToolButton>
        </div>

        {/* the rail — the machine's pulse while it holds the lock.
            One 2px element in every phase: the idle spacer used to be h-0.5,
            2.2px at the 110% root, a hair off the rail it stood in for. */}
        <div className={`relative h-[2px] ${locked ? "dc-rail" : ""}`} />

        {/* ── the monument ────────────────────────────────────────────────── */}
        <div className="relative grid gap-6 px-6 pb-6 pt-9 lg:grid-cols-[1fr_380px] lg:items-center lg:p-8">
          {/* ── the lockdown notice ─────────────────────────────────────────
              Laid over the monument's top padding instead of inserted above
              it (2026-11-06). In flow it pushed the monument down 29px as the
              lock engaged and pulled it back as the verdict landed: two layout
              shifts per run, mid first screen. It is one line, ~31px, so the
              padding has room for it at every width (pt-9 below lg, where it
              was p-6) and a phone gets the short copy, not a second line. */}
          {locked && (
            <div className="dc-line absolute inset-x-0 top-0 flex items-stretch border-b border-border-soft bg-bg-soft">
              <span className="t-label min-w-0 truncate px-4 py-1.5 text-fg-dim">
                Workspace locked · <span className="hidden sm:inline">run in progress · </span>inputs frozen
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="t-eyebrow whitespace-nowrap text-brand-ink">The workbench</div>

            {/* Every headline this band can print, stacked in one grid cell
                (2026-11-06). The cell takes the tallest, so the verdict cannot
                resize the card by wrapping differently from "Run the tape."
                (at 360px "mixed." is one line and "Run the tape." two). Only
                the live one shows; the rest are invisible, aria-hidden spacers. */}
            <div className="mt-1.5 grid">
              {settled ? (
                <h2
                  className={`dc-verdict col-start-1 row-start-1 ${HEADLINE}`}
                  style={{ color: sideColor(aggregate) }}
                >
                  {sentence(AGGREGATE_READ[aggregate])}.
                </h2>
              ) : (
                <h2
                  className={`col-start-1 row-start-1 ${HEADLINE} text-fg transition-opacity duration-400 [transition-timing-function:var(--ease-settle)]`}
                  style={{ opacity: locked ? 0.35 : 1 }}
                >
                  <RunTheTape />
                </h2>
              )}
              <div aria-hidden className={`invisible col-start-1 row-start-1 ${HEADLINE}`}>
                <RunTheTape />
              </div>
              {Object.values(AGGREGATE_READ).map((read) => (
                <div key={read} aria-hidden className={`invisible col-start-1 row-start-1 ${HEADLINE}`}>
                  {sentence(read)}.
                </div>
              ))}
            </div>

            {/* The same for the line under it: the verdict's counts run
                longer than "4 staged", and gain a fourth item when a bot reads
                caution. A spacer holding the longest line this can print (each
                count at the stack's size, the longest tape name) keeps the
                height it will need from the first frame; content-start packs
                the live rows at the top instead of spreading them over it. */}
            <div className="mt-2 grid">
              <div className="t-label col-start-1 row-start-1 flex flex-wrap content-start gap-x-3.5 gap-y-1 text-fg-faint">
                {settled ? (
                  <>
                    <span className="text-bull">{counts.buy} {READ.buy}</span>
                    <span>·</span>
                    <span>{counts.hold} {READ.hold}</span>
                    <span>·</span>
                    <span className="text-bear">{counts.sell} {READ.sell}</span>
                    {counts.warn > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber">{counts.warn} {READ.warn}</span>
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
                    "seed tape" is exactly the contradiction the simulated-data
                    lamp exists to prevent. */}
                <span className="text-amber">
                  {dataSource === "live"
                    ? "live tape · not advice"
                    : dataSource === "fallback"
                      ? "fallback tape · not advice"
                      : "seed tape · not advice"}
                </span>
              </div>
              <div aria-hidden className="t-label invisible col-start-1 row-start-1 flex flex-wrap gap-x-3.5 gap-y-1">
                {(["buy", "hold", "sell", "warn"] as const).map((side) => (
                  <Fragment key={side}>
                    <span>{total} {READ[side]}</span>
                    <span>·</span>
                  </Fragment>
                ))}
                <span>walk-forward · no lookahead</span>
                <span>·</span>
                <span>fallback tape · not advice</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-11 gap-y-7">
              {METRICS.map((m) => (
                <div key={m.label}>
                  {/* Sentence case by CSS: __tests__/quant-rendered-copy pins "agreement". */}
                  <div className="t-label text-fg-faint first-letter:uppercase">{m.label}</div>
                  <div
                    className={`t-data mt-1 text-[1.875rem] tracking-[-0.02em] ${
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
              className={`t-label flex items-center justify-between rounded-t-[inherit] border-b border-border bg-bg-soft px-3 py-2 ${
                locked ? "text-brand-ink" : "text-fg-dim"
              }`}
            >
              <span>Run stream</span>
              <span className="tabular-nums text-fg-faint">
                {armed}/{total}
              </span>
            </div>

            <div className="min-h-[8.625rem] px-3.5 py-3 font-mono text-[0.6875rem] leading-[1.7] text-fg-dim">
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
                        i === LOG.length - 1 ? "text-fg" : "text-fg-dim"
                      }
                    >
                      {l}
                    </span>
                  </div>
                ))
              )}
              {locked && <span className="blink text-brand-ink">▌</span>}
            </div>

            {/* one cell per staged bot, armed in the order they land and
                coloured by that bot's own verdict */}
            <div className="grid grid-cols-9 gap-1 px-3.5 pb-3.5">
              {rows.map((r) => {
                const v = r.result?.verdict.side;
                const c = v ? sideColor(v) : null;
                return (
                  <div
                    key={r.active.uid}
                    className={c ? "dc-cell" : undefined}
                    title={`${r.def.name}${v ? ` · read ${READ[v]}` : " · pending"}`}
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

            <div className="t-label flex items-center justify-between rounded-b-[inherit] border-t border-border bg-bg-soft px-3 py-1.5 text-fg-faint">
              <span>
                <span className="text-bull">{counts.buy} {READ.buy}</span> · {counts.hold} {READ.hold} ·{" "}
                <span className="text-bear">{counts.sell} {READ.sell}</span>
              </span>
              <span>In-process</span>
            </div>
          </div>
        </div>

        {/* ── the standing disclaimer — on screen at all times ─────────────── */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-b-[inherit] border-t border-border bg-bg-soft px-4 py-2">
          <Chip tone={settled ? "brand" : "neutral"} dot>
            {settled ? "Lock released" : locked ? "Lockdown" : "Standing by"}
          </Chip>
          <span className="t-label text-fg-faint">
            Backtests are teaching instruments, not track records · never investment advice
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

  // lockdown → streaming: a 700ms beat so the lock notice and the rail are
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
