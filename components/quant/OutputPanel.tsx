"use client";

import type { BotDef, BotResult, ActiveBot, Verdict } from "@/lib/quant/types";
import { EquitySpark } from "./MiniViz";

export type RunRow = {
  active: ActiveBot;
  def: BotDef;
  result: BotResult | null;
};

export function OutputPanel({
  runs,
  symbol,
  spot,
  beginner,
}: {
  runs: RunRow[];
  symbol: string;
  spot: number;
  beginner: boolean;
}) {
  const completed = runs.filter((r) => r.result !== null);
  const verdicts = completed.map((r) => r.result!.verdict);
  const counts = countSides(verdicts);
  const score = (counts.buy - counts.sell) / Math.max(1, verdicts.length);
  const aggregate: Verdict["side"] = score > 0.25 ? "buy" : score < -0.25 ? "sell" : counts.warn > 0 && counts.buy === 0 ? "warn" : "hold";

  const conf =
    verdicts.length === 0
      ? 0
      : verdicts.reduce((a, b) => a + (b.confidence ?? 0), 0) / verdicts.length;

  const allSignals = completed.flatMap((r) =>
    r.result!.signals.map((s) => ({ bot: r.def.name, sig: s }))
  );
  const recent = allSignals.slice(-12).reverse();

  const equityRuns = completed.filter((r) => r.result!.equity && r.result!.equity!.length > 5);

  return (
    <aside className="flex h-full flex-col border border-border bg-surface">
      <div className="border-b border-border bg-bg-soft px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-base tracking-tightest text-fg">Output</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            {completed.length}/{runs.length} ran
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          aggregate verdict for {symbol}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Aggregate verdict block */}
        <div className="border-b border-border p-3">
          <AggregateVerdict
            side={aggregate}
            counts={counts}
            confidence={conf}
            spot={spot}
          />
        </div>

        {/* Per-bot verdicts */}
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            <span>per bot</span>
            <span>{completed.length} verdicts</span>
          </div>
          {completed.length === 0 && (
            <div className="grid h-16 place-items-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              run bots to see verdicts
            </div>
          )}
          <div className="space-y-1.5">
            {completed.map((r) => {
              const v = r.result!.verdict;
              const tone =
                v.side === "buy" ? "text-bull" : v.side === "sell" ? "text-bear" : v.side === "warn" ? "text-amber" : "text-fg-dim";
              return (
                <div key={r.active.uid} className="grid grid-cols-[16px_1fr_auto] items-baseline gap-2">
                  <span className={`size-2 rounded-full ${dotBg(v.side)}`} />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] text-fg">{r.def.name}</div>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${tone}`}>{v.side}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Combined signal stream */}
        <div className="border-b border-border p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            recent signals
          </div>
          {recent.length === 0 ? (
            <div className="grid h-16 place-items-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              no signals yet
            </div>
          ) : (
            <div className="space-y-1 font-mono text-[10px] tabular-nums">
              {recent.map((s, i) => (
                <div key={i} className="grid grid-cols-[24px_50px_1fr_auto] items-center gap-2 border-l-2 border-border-soft pl-2"
                  style={{ borderLeftColor: s.sig.kind === "buy" ? "var(--bull)" : s.sig.kind === "sell" ? "var(--bear)" : "var(--amber)" }}>
                  <span className="text-fg-faint">t{s.sig.i}</span>
                  <span className={s.sig.kind === "buy" ? "text-bull" : s.sig.kind === "sell" ? "text-bear" : "text-amber"}>
                    {s.sig.kind.toUpperCase()}
                  </span>
                  <span className="truncate text-fg-dim">{s.bot}</span>
                  {s.sig.price && <span className="text-fg">${s.sig.price.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equity leaderboard */}
        {equityRuns.length > 0 && (
          <div className="border-b border-border p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              backtest leaderboard
            </div>
            <div className="space-y-2">
              {equityRuns
                .map((r) => {
                  const eq = r.result!.equity!;
                  const ret = eq[eq.length - 1] / eq[0] - 1;
                  return { def: r.def, eq, ret };
                })
                .sort((a, b) => b.ret - a.ret)
                .map((row) => (
                  <div key={row.def.id} className="border border-border-soft bg-bg p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                        {row.def.name}
                      </span>
                      <span className={`font-mono text-[11px] tabular-nums ${row.ret >= 0 ? "text-bull" : "text-bear"}`}>
                        {row.ret >= 0 ? "+" : ""}
                        {(row.ret * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-7">
                      <EquitySpark equity={row.eq} width={300} height={28} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Teacher card */}
        {beginner && completed.length > 0 && (
          <div className="border-b border-border bg-bull/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-bull">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              teacher note
            </div>
            <p className="text-[12px] leading-relaxed text-fg">
              {teacherNote(aggregate, counts, equityRuns.length)}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function AggregateVerdict({
  side,
  counts,
  confidence,
  spot,
}: {
  side: Verdict["side"];
  counts: { buy: number; sell: number; hold: number; warn: number };
  confidence: number;
  spot: number;
}) {
  const bg =
    side === "buy"
      ? "bg-bull/15 border-bull/30"
      : side === "sell"
      ? "bg-bear/15 border-bear/30"
      : side === "warn"
      ? "bg-amber/15 border-amber/30"
      : "bg-fg/5 border-border";
  const text =
    side === "buy"
      ? "text-bull"
      : side === "sell"
      ? "text-bear"
      : side === "warn"
      ? "text-amber"
      : "text-fg-dim";

  return (
    <div className={`border ${bg} p-3`}>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span>aggregate</span>
        <span>spot ${spot.toFixed(2)}</span>
      </div>
      <div className={`mt-1 font-display text-3xl tracking-tightest ${text}`}>{side.toUpperCase()}</div>
      <div className="mt-2 grid grid-cols-4 gap-px overflow-hidden border border-border bg-border">
        {[
          { l: "buy", v: counts.buy, c: "text-bull" },
          { l: "sell", v: counts.sell, c: "text-bear" },
          { l: "hold", v: counts.hold, c: "text-fg-dim" },
          { l: "warn", v: counts.warn, c: "text-amber" },
        ].map((row) => (
          <div key={row.l} className="bg-bg p-2 text-center">
            <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{row.l}</div>
            <div className={`font-mono text-base tabular-nums ${row.c}`}>{row.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          <span>conviction</span>
          <span>{(confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full bg-bg">
          <div
            className="h-full bg-bull transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, confidence * 100)).toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function countSides(vs: Verdict[]) {
  const c = { buy: 0, sell: 0, hold: 0, warn: 0 };
  for (const v of vs) c[v.side]++;
  return c;
}

function dotBg(side: Verdict["side"]) {
  return side === "buy" ? "bg-bull" : side === "sell" ? "bg-bear" : side === "warn" ? "bg-amber" : "bg-fg-dim";
}

function teacherNote(side: Verdict["side"], counts: ReturnType<typeof countSides>, btCount: number) {
  if (counts.buy + counts.sell + counts.hold + counts.warn === 0) {
    return "Add a bot or two from the library, then press RUN ALL. The agreement between bots is more interesting than any single one.";
  }
  if (side === "buy" && counts.buy >= 2) {
    return `${counts.buy} bots agree on long. When independent methods land on the same answer, you have a real signal — not just a coincidence. Risk-size accordingly.`;
  }
  if (side === "sell" && counts.sell >= 2) {
    return `${counts.sell} bots want to sell. Multiple methods pointing the same way is your best evidence. If you don't want to short, at least don't be long here.`;
  }
  if (counts.buy > 0 && counts.sell > 0) {
    return `Bots disagree (${counts.buy} buy / ${counts.sell} sell). That usually means trend & reversion bots are fighting — the market is in transition. Wait for confirmation.`;
  }
  if (btCount > 0) {
    return `Backtest leaderboard at the top of this panel ranks your bots by realised return on this seed. Past returns don't guarantee future ones, but a bot that lost money in the past rarely surprises.`;
  }
  return "Stack a few more bots — one signal is a guess, three is a thesis.";
}
