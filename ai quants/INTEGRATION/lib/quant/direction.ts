/**
 * Direction-prediction helpers for LAZYBULL UI.
 *
 * IMPORTANT: never expose raw p_up to retail users. Always use the tier system.
 */
import { consensus, quantile, type ConsensusResult } from "../quant-ai";

export type Tier = "ultra" | "high" | "medium" | "low";

/** Color + label per tier, for the AI signal badge. */
export const TIER_DISPLAY: Record<Tier, { label: string; color: string; emoji: string }> = {
  ultra:  { label: "Strong",     color: "#22c55e", emoji: "🟢" },  // ~70-77% acc
  high:   { label: "Moderate",   color: "#eab308", emoji: "🟡" },  // ~60-66% acc
  medium: { label: "Weak",       color: "#94a3b8", emoji: "⚪" },  // ~55-60% acc
  low:    { label: "No edge",    color: "#94a3b8", emoji: "⚪" },  // base rate
};

export interface AISignal {
  ticker: string;
  direction: "up" | "down" | "split";
  tier: Tier;
  display: typeof TIER_DISPLAY[Tier];
  expectedReturn: number;        // from magnitude model, decimal e.g. 0.025 = +2.5%
  agreement: string;             // "5/5", "4/5", etc.
  expectedAccuracy: string;      // human-readable band e.g. "60-66%"
}

/** Get the consensus signal for a ticker, formatted for display. */
export async function getAISignal(ticker: string): Promise<AISignal> {
  const r: ConsensusResult = await consensus(ticker);
  return {
    ticker: r.ticker,
    direction: r.consensus.direction,
    tier: r.consensus.tier,
    display: TIER_DISPLAY[r.consensus.tier],
    expectedReturn: r.consensus.avg_magnitude * (r.consensus.direction === "up" ? 1 : -1),
    agreement: `${r.consensus.agree_count}/${r.consensus.n_models}`,
    expectedAccuracy: r.consensus.expected_accuracy_band,
  };
}

/** Confidence-interval forecast: returns 80% band of expected 20-day return. */
export async function getReturnBand(ticker: string): Promise<{
  lower: number; median: number; upper: number; decision: string;
}> {
  const q = await quantile(ticker);
  return { lower: q.p10, median: q.p50, upper: q.p90, decision: q.decision };
}
