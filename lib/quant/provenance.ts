// The single source of truth for "where did this number come from". Every
// quant card renders a badge from this — real, specific, and honest, so the
// app reads like a professional quant platform instead of a demo. No card
// ever says "Mock" for output that is, in fact, exact Black-Scholes math or a
// real neural net running on your machine.

import type { BotCategory, SourceId, Tone } from "./types";

export const SOURCE_META: Record<
  SourceId,
  { label: string; short: string; tip: string; tone: Tone }
> = {
  hosted: {
    label: "Hosted API",
    short: "API",
    tip: "Live inference on our GPU servers — the full trained model, lowest latency (the paid tier).",
    tone: "bull",
  },
  "device-cnn": {
    label: "On-device CNN",
    short: "CNN",
    tip: "A 1-D convolutional network running in your browser via WebAssembly — the real trained weights, on your machine, no server. Reads the last 60 daily candles.",
    tone: "bull",
  },
  "device-transformer": {
    label: "On-device Transformer",
    short: "TXR",
    tip: "A transformer encoder running in your browser via WebAssembly — real trained weights, on your machine. Attends over 252 days of price data.",
    tone: "bull",
  },
  snapshot: {
    label: "Model snapshot",
    short: "SNAP",
    tip: "The real trained model's output, computed offline and shipped as a daily snapshot (for tickers not yet run on-device).",
    tone: "info",
  },
  "black-scholes": {
    label: "Black-Scholes",
    short: "BS",
    tip: "Exact closed-form options mathematics, computed in your browser — the 1973 formula, not an approximation.",
    tone: "info",
  },
  "monte-carlo": {
    label: "Monte Carlo",
    short: "MC",
    tip: "A simulation-based estimate: thousands of random price paths averaged, computed in your browser.",
    tone: "info",
  },
  statistical: {
    label: "Statistical model",
    short: "STAT",
    tip: "A classical statistical estimator (regression, z-score, Hurst, Kelly…) computed in your browser — deterministic and reproducible.",
    tone: "info",
  },
  technical: {
    label: "Technical rule",
    short: "TA",
    tip: "A classical technical-analysis rule (moving averages, MACD, Donchian…) computed in your browser.",
    tone: "info",
  },
  heuristic: {
    label: "Heuristic",
    short: "HEUR",
    tip: "A lightweight deterministic stand-in, shown only when the trained model can't be reached. Not the neural network.",
    tone: "warn",
  },
  custom: {
    label: "Your code",
    short: "YOU",
    tip: "A bot you wrote and hot-loaded into the workspace. Runs your function in your browser.",
    tone: "info",
  },
};

// Default provenance for bots that don't set one explicitly — derived from the
// bot's family. (The AI bots always set their own source at run time.)
export function sourceForCategory(cat: BotCategory): SourceId {
  switch (cat) {
    case "options":
      return "black-scholes";
    case "trend":
      return "technical";
    case "stats":
    case "risk":
      return "statistical";
    case "custom":
      return "custom";
    case "ai":
      return "heuristic"; // an AI bot with no set source fell back
    default:
      return "statistical";
  }
}
