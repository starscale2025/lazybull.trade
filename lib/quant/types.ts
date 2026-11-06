import type { Candle } from "../candles";

// ── the two strings every performance figure in the workbench is written
// against. They live here, in the module both lib/quant/ai-bots.ts and
// lib/quant/bot-content.ts already share, so a number and its hedge can never
// drift apart across surfaces.

/**
 * Stamped beside EVERY accuracy figure this workbench prints. The 2026-09
 * diligence memo's ask, verbatim: "One canonical accuracy band, always
 * labelled hypothetical". One constant, so no surface can quietly drop it.
 */
export const HYPOTHETICAL_NOTE = "hypothetical · out-of-sample · not a forecast";

/**
 * The ONE out-of-sample hit-rate band these models are described by.
 *
 * There used to be a LADDER of four bands, each tier richer than the last,
 * which reads exactly like a grade scale: the more the models agree, the
 * better your odds are said to be. Two problems. Its top rung sat well above
 * anything the out-of-sample runs support (see `ai quants/README.md`), and a
 * band that rises with agreement turns a dispersion measure into a promise.
 * So there is one band now, and the agreement label says only how much the
 * models agreed — never how likely anything is.
 */
export const ACCURACY_BAND = "55–66%";

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
  /** The last session a tape-reading model saw, printed on the card: a day
      (YYYY-MM-DD), or where an undated window ends. Everything after it is
      what the tape did next (lib/quant/reads). */
  asOf?: string;
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
