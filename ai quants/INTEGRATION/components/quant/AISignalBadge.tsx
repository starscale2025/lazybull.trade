"use client";

import { useEffect, useState } from "react";
import { getAISignal, type AISignal } from "@/lib/quant/direction";

interface Props {
  ticker: string;
  /** Period of history to fetch — default 2y is plenty. */
  period?: string;
  /** Refresh every N seconds (default: only on mount). */
  refreshSec?: number;
}

/**
 * AI directional signal for a ticker, displayed with honest tier-banded
 * confidence. NEVER shows raw probabilities to users.
 */
export function AISignalBadge({ ticker, period = "2y", refreshSec }: Props) {
  const [signal, setSignal] = useState<AISignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchSignal() {
      try {
        const s = await getAISignal(ticker);
        if (!cancelled) { setSignal(s); setErr(null); }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSignal();
    if (refreshSec) {
      const id = setInterval(fetchSignal, refreshSec * 1000);
      return () => { cancelled = true; clearInterval(id); };
    }
    return () => { cancelled = true; };
  }, [ticker, refreshSec]);

  if (loading) return <span className="text-xs text-slate-400">…</span>;
  if (err) return <span className="text-xs text-red-400" title={err}>signal err</span>;
  if (!signal) return null;

  const arrow = signal.direction === "up" ? "↑" : signal.direction === "down" ? "↓" : "→";
  const pctText = `${signal.expectedReturn >= 0 ? "+" : ""}${(signal.expectedReturn * 100).toFixed(1)}%`;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
      style={{ background: `${signal.display.color}22`, color: signal.display.color, border: `1px solid ${signal.display.color}55` }}
      title={`AI signal: ${signal.agreement} models agree • expected accuracy ${signal.expectedAccuracy} • not financial advice`}
    >
      <span>{signal.display.emoji}</span>
      <span className="font-semibold">{signal.display.label}</span>
      <span className="opacity-80">{arrow} {pctText} (20d)</span>
    </div>
  );
}
