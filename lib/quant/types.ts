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
  kind: "buy" | "sell" | "warn";
  price?: number;
  label?: string;
};

export type Tone = "bull" | "bear" | "neutral" | "warn" | "info";

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
  risk: { id: "risk", label: "Risk & Sizing", hint: "how much to bet", color: "var(--amber)" },
  options: { id: "options", label: "Options", hint: "pricing & vol games", color: "var(--plasma)" },
  ai: { id: "ai", label: "AI Quants", hint: "trained on real markets", color: "var(--bear)" },
  custom: { id: "custom", label: "Your Bots", hint: "imported by you", color: "var(--fg)" },
};
