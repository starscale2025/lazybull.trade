// Sandbox for user-defined bots imported into the workbench. The user supplies
// a JS snippet that returns a `BotResult`-shaped object. The function receives
// a context (candles + helpers) and a params object.

import type { BotDef, BotResult, BotContext } from "./types";
import * as series from "./series";

const HELPERS = {
  ...series,
};

export type CustomBotInput = {
  id?: string;
  name: string;
  category?: "custom";
  glyph?: string;
  tagline?: string;
  formula?: string;
  params?: BotDef["params"];
  // body is the function body. Must end with `return result;` where result is BotResult.
  body: string;
};

export function compileCustomBot(input: CustomBotInput): BotDef {
  const id = input.id || `user-${slug(input.name)}-${(Math.random() * 1e6) | 0}`;
  const fn = new Function(
    "ctx",
    "params",
    "math",
    "helpers",
    `"use strict";\n${input.body}`
  ) as (ctx: BotContext, params: Record<string, unknown>, math: Math, h: typeof HELPERS) => unknown;

  return {
    id,
    name: input.name,
    category: "custom",
    glyph: input.glyph || "★",
    tagline: input.tagline || "Custom bot.",
    formula: input.formula,
    params: input.params || [],
    run: (ctx, params): BotResult => {
      try {
        const out = fn(ctx, params, Math, HELPERS);
        return normalise(out);
      } catch (err) {
        return {
          signals: [],
          metrics: [{ key: "err", label: "Error", value: (err as Error).message.slice(0, 60), tone: "warn" }],
          summary: `Bot crashed: ${(err as Error).message}`,
          verdict: { side: "warn", text: "Bot threw an error — check the code.", confidence: 0 },
        };
      }
    },
  };
}

function normalise(out: unknown): BotResult {
  if (typeof out !== "object" || out === null) {
    return {
      signals: [],
      metrics: [],
      summary: "Bot returned no result.",
      verdict: { side: "hold", text: "—", confidence: 0 },
    };
  }
  const o = out as Partial<BotResult>;
  return {
    signals: Array.isArray(o.signals) ? o.signals : [],
    metrics: Array.isArray(o.metrics) ? o.metrics : [],
    pane: o.pane,
    overlay: o.overlay,
    summary: typeof o.summary === "string" ? o.summary : "Custom bot result.",
    beginner: o.beginner,
    verdict: o.verdict ?? { side: "hold", text: "—", confidence: 0 },
    equity: o.equity,
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const SAMPLE_CUSTOM_BOT = `// Your bot has access to:
//   ctx.candles  — { o, h, l, c }[]
//   ctx.symbol   — string
//   params       — your params object
//   math         — JS Math
//   helpers      — { sma, ema, rsi, macd, bollinger, zscore, std, returns,
//                    sharpe, sortino, hurst, kalman, fmtPct, fmtNum, fmtMoney, ... }

const px = ctx.candles.map(c => c.c);
const fast = helpers.ema(px, params.fast || 8);
const slow = helpers.ema(px, params.slow || 21);

const last = px[px.length - 1];
const f = fast[fast.length - 1];
const s = slow[slow.length - 1];
const bullish = f > s;

const result = {
  signals: [],
  metrics: [
    { key: "fast", label: "Fast EMA", value: f.toFixed(2), tone: "info" },
    { key: "slow", label: "Slow EMA", value: s.toFixed(2), tone: "info" },
    { key: "spread", label: "Spread", value: helpers.fmtPct((f - s) / s), tone: bullish ? "bull" : "bear" },
  ],
  overlay: [
    { values: fast, color: "var(--bull)", label: "EMA fast" },
    { values: slow, color: "var(--cyan)", label: "EMA slow" },
  ],
  summary: \`Custom EMA spread: \${((f - s) / s * 100).toFixed(2)}%\`,
  beginner: "Your bot is comparing two exponential moving averages.",
  verdict: {
    side: bullish ? "buy" : "sell",
    text: bullish ? "Fast > slow" : "Fast < slow",
    confidence: 0.7,
  },
};

return result;`;
