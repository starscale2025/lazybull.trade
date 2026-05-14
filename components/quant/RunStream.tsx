"use client";

/**
 * Streaming "terminal" output that prints while a bot is computing.
 *
 * Even though `def.run()` resolves synchronously for most local bots, we
 * stage a 7–9 line typewriter sequence to give the act of running a bot
 * presence and rhythm. The lines describe what the bot is *actually* doing
 * (dataset, params, formula, endpoint) — they're truthful, not chrome.
 *
 * After the budgeted duration elapses the parent (BotCell) is notified via
 * `onComplete`, which transitions the cell into the `decimating` phase so
 * the metric numbers can scramble-resolve into place.
 */

import { useEffect, useMemo, useRef } from "react";
import type { BotDef } from "@/lib/quant/types";

type Line = { text: string; tone?: "info" | "ok" | "warn" };

export function RunStream({
  def,
  symbol,
  bars,
  params,
  onComplete,
  durationMs,
}: {
  def: BotDef;
  symbol: string;
  bars: number;
  params: Record<string, number | string | boolean>;
  onComplete: () => void;
  durationMs: number;
}) {
  // Build the stream lines once per (def, symbol, bars, params) tuple so
  // re-renders during the animation don't shuffle the contents.
  const lines = useMemo(
    () => buildLines(def, symbol, bars, params),
    [def, symbol, bars, params]
  );

  const completedRef = useRef(false);
  useEffect(() => {
    completedRef.current = false;
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, durationMs);
    return () => {
      completedRef.current = true;
      clearTimeout(timer);
    };
  }, [durationMs, onComplete]);

  const perLineDelay = Math.max(60, (durationMs - 180) / Math.max(lines.length, 1));

  return (
    <div className="relative overflow-hidden border border-border-soft bg-bg p-3 font-mono text-[11px] leading-[1.55]">
      <div className="cell-running-rail" aria-hidden />

      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-fg-faint">
        <span className="flex items-center gap-2 text-bull">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          running
        </span>
        <span>{def.id}</span>
      </div>

      <div className="space-y-0.5 text-fg-dim">
        {lines.map((ln, i) => (
          <div
            key={i}
            className="run-stream-line"
            style={{ animationDelay: `${i * perLineDelay}ms` }}
          >
            <span className="text-fg-faint">{">"} </span>
            <span
              className={
                ln.tone === "ok"
                  ? "text-bull"
                  : ln.tone === "warn"
                    ? "text-amber"
                    : "text-fg-dim"
              }
            >
              {ln.text}
            </span>
          </div>
        ))}
        <div
          className="run-stream-line inline-flex items-center gap-1"
          style={{ animationDelay: `${lines.length * perLineDelay}ms` }}
        >
          <span className="text-bull">▌</span>
          <span className="text-fg-faint">resolving…</span>
        </div>
      </div>
    </div>
  );
}

function buildLines(
  def: BotDef,
  symbol: string,
  bars: number,
  params: Record<string, number | string | boolean>
): Line[] {
  const lines: Line[] = [];
  lines.push({ text: `compute · ${def.name.toLowerCase()} · ${def.id}` });
  lines.push({ text: `dataset · ${symbol} · ${bars} bars · close[]` });

  const paramEntries = def.params.slice(0, 3).map((p) => `${p.key}=${formatParam(params[p.key])}`);
  if (paramEntries.length > 0) {
    lines.push({ text: `params · ${paramEntries.join("  ")}` });
  }

  if (def.formula) {
    const f = def.formula.length > 64 ? def.formula.slice(0, 64) + "…" : def.formula;
    lines.push({ text: `f(x) · ${f}` });
  }

  if (def.endpoint) {
    lines.push({ text: `api · POST ${def.endpoint}`, tone: "info" });
  } else if (def.module) {
    lines.push({ text: `src · ${def.module}` });
  }

  // A pseudo-progress line that's bot-category-aware so the stream feels
  // computational rather than canned.
  switch (def.category) {
    case "ai":
      lines.push({ text: `tensor · forward pass · 1×${bars}`, tone: "info" });
      break;
    case "trend":
      lines.push({ text: `scanning · ${bars} bars · O(n)` });
      break;
    case "stats":
      lines.push({ text: `stats · ${bars} samples · μ σ ρ` });
      break;
    case "risk":
      lines.push({ text: `simulating · monte carlo · 10k paths` });
      break;
    case "options":
      lines.push({ text: `pricing · black-scholes · σ √t` });
      break;
    default:
      lines.push({ text: `processing · ${bars} bars` });
  }

  lines.push({ text: `signals · resolving`, tone: "ok" });
  lines.push({ text: `verdict · settling`, tone: "ok" });
  return lines;
}

function formatParam(v: number | string | boolean | undefined): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === "boolean") return v ? "on" : "off";
  return String(v ?? "—");
}
