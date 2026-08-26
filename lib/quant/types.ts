import type { Candle } from "../candles";

export type ParamSpec =
  | {
      key: string;
      label: string;
      kind: "number";
      default: number;
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      hint?: string;
    }
  | {
      key: string;
      label: string;
      kind: "select";
      default: string;
      options: { value: string; label: string }[];
      hint?: string;
    }
  | {
      key: string;
      label: string;
      kind: "boolean";
      default: boolean;
      hint?: string;
    };

export type BotCategory = "trend" | "stats" | "risk" | "options" | "ai" | "custom";

export type Signal = {
  i: number;
  // impersonal, hypothetical model events for education — not buy/sell calls
  kind: "long" | "short" | "warn";
  price?: number;
  label?: string;
};

export type Tone = "bull" | "bear" | "neutral" | "warn" | "info";

// Where a bot's output actually came from — surfaced on every card so the
// provenance is honest (no more "Mock" on real Black-Scholes math).
export type SourceId =
  | "hosted" // live inference on our servers (paid tier)
  | "device-cnn" // 1D-CNN in the browser (WASM)
  | "device-transformer" // transformer in the browser (WASM)
  | "snapshot" // real trained-model output, daily static snapshot
  | "black-scholes" // exact closed-form options math, client-side
  | "monte-carlo" // simulation-based estimate, client-side
  | "statistical" // classical statistical estimator, client-side
  | "technical" // classical technical-analysis rule, client-side
  | "heuristic" // lightweight deterministic stand-in for an unreachable NN
  | "custom"; // a hot-loaded bot the user imported

export type Metric = {
  key: string;
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
};

export type Verdict = {
  side: "buy" | "sell" | "hold" | "warn";
  text: string;
  confidence?: number; // 0-1
};

export type Pane = {
  kind: "line" | "histogram" | "bands" | "heat";
  series: { values: (number | null)[]; color: string; label: string; dashed?: boolean }[];
  refLines?: { value: number; color: string; label?: string }[];
  height?: number;
};

export type BotResult = {
  signals: Signal[];
  metrics: Metric[];
  pane?: Pane;
  overlay?: { values: (number | null)[]; color: string; label: string; dashed?: boolean }[];
  summary: string;
  beginner?: string;
  verdict: Verdict;
  // optional equity curve from a backtest (relative pnl)
  equity?: number[];
  // provenance — where this output came from (defaults to the bot's category
  // if unset). `sourceNote` carries a date/version for the badge tooltip.
  source?: SourceId;
  sourceNote?: string;
  horizon?: string; // e.g. "20d" — the prediction horizon, when applicable
};

export type BotContext = {
  candles: Candle[];
  symbol: string;
};

export type BotDef = {
  id: string;
  name: string;
  category: BotCategory;
  glyph: string;
  tagline: string;
  formula?: string;
  /** Optional FastAPI endpoint on the python side. Surfaced in the UI. */
  endpoint?: string;
  /** Underlying python module (for the "Provenance" line). */
  module?: string;
  params: ParamSpec[];
  run: (
    ctx: BotContext,
    params: Record<string, number | string | boolean>,
  ) => BotResult | Promise<BotResult>;
};

export type ActiveBot = {
  uid: string;
  defId: string;
  params: Record<string, number | string | boolean>;
  collapsed?: boolean;
};

export type CategoryMeta = {
  id: BotCategory;
  label: string;
  hint: string;
  color: string;
};

export const CATEGORY_META: Record<BotCategory, CategoryMeta> = {
  trend: { id: "trend", label: "Trend & Momentum", hint: "follow the move", color: "var(--bull)" },
  stats: { id: "stats", label: "Statistical", hint: "the math under the move", color: "var(--cyan)" },
  risk: { id: "risk", label: "Risk & Sizing", hint: "how much to risk", color: "var(--amber)" },
  options: { id: "options", label: "Options", hint: "pricing & vol games", color: "var(--plasma)" },
  ai: { id: "ai", label: "AI Quants", hint: "trained on real markets", color: "var(--bear)" },
  custom: { id: "custom", label: "Your Bots", hint: "imported by you", color: "var(--fg)" },
};
