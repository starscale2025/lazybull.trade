// The "brain" contract for the FREE voice engine (OpenRouter text model +
// browser speech). Free models can't be trusted to do native tool-calling
// reliably, so instead we ask for a strict JSON reply we fully control:
//   { "speech": "<what to say out loud>", "actions": [ { "tool", "args" } ] }
// and parse it defensively. Persona tone is reused from personality.ts.

import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "./personality";
import type { MarketAnalysis } from "./analysis";
import type { WorkspaceState } from "./useVoiceAgent";

export type BrainAction = { tool: string; args: Record<string, unknown> };
export type BrainReply = { speech: string; actions: BrainAction[] };

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const ACTION_CATALOG = `AVAILABLE ACTIONS (emit in the "actions" array; use exact tool names). You have FULL control of this workspace:

CHART
- set_symbol {"ticker": string}            → change the charted ticker (AAPL, NVDA, BTC-USD, SPY…)
- set_timeframe {"timeframe": "1m"|"5m"|"15m"|"1h"|"4h"|"D"|"W"|"M"}
- set_chart_type {"chart": "candles"|"line"|"area"|"bars"}
- set_layout {"panes": 1|2|3|4}            → split into multiple chart panes
- set_range {"preset": "1D"|"5D"|"1M"|"3M"|"6M"|"YTD"|"1Y"|"5Y"|"All"}
- zoom_to {"bars": number}                 → fit the last N bars
- toggle_fullscreen {}
- snapshot {}                              → screenshot the chart
- save_workspace {}                        → save / share the layout

INDICATORS  (ids: ema20, ema50, rsi, macd, bb, vwap, ichimoku, supertrend)
- add_indicator {"indicator": id}
- remove_indicator {"indicator": id}
- clear_indicators {}

DRAWING  (prices are absolute; *_bars_ago counts back from the newest bar, 0 = now)
- draw_horizontal {"price": number}                                   → support/resistance line
- draw_trendline {"from_price": n, "to_price": n, "from_bars_ago"?: n, "to_bars_ago"?: n}
- draw_fib {"from_price": number, "to_price": number}                 → fib retracement
- draw_rect {"from_price": n, "to_price": n, "from_bars_ago"?: n, "to_bars_ago"?: n}
- draw_text {"price": number, "text": string, "bars_ago"?: number}    → label on the chart
- select_tool {"tool": "cursor"|"trendline"|"horizontal"|"ray"|"rect"|"fib"|"channel"|"text"|"brush"|"measure"|"callout"|"eraser"}
- set_color {"color": "#rrggbb"}
- clear_drawings {} · undo {} · redo {}

ALERTS
- create_alert {"price": number, "condition": "above"|"below", "note"?: string}
- delete_alert {"price": number}           → removes the alert nearest that price
- clear_alerts {} · open_alerts {"open": boolean}

REPLAY (scrub the historical tape)
- start_replay {} · stop_replay {}
- set_replay_playing {"playing": boolean}
- set_replay_speed {"speed": 1-10}
- replay_seek {"to"?: number, "step"?: number}   → jump to a bar, or step +/- N bars

WATCHLIST
- add_to_watchlist {"ticker": string} · remove_from_watchlist {"ticker": string}

TRADING (paper only)
- open_trade_panel {"open": boolean}
- stage_paper_trade {"side": "buy"|"sell", "quantity": number, "order_type": "market"|"limit", "limit_price"?: number}
- confirm_paper_trade {}                   → place the staged order (ONLY after the user says yes)
- cancel_staged_trade {}

LOOKUPS (these return data — after using one, you'll get the result and can then answer)
- lookup_symbol {"ticker": string}         → quote/trend for ANOTHER symbol without leaving the current chart
- search_symbols {"query": string}         → find tickers by name`;

const RULES = `HARD RULES:
1. NUMBERS ARE SACRED. Only use figures from the LIVE MARKET SNAPSHOT provided each turn. Never invent a price, %, RSI, or level.
2. TRADES ALWAYS CONFIRM. To trade: first emit stage_paper_trade, and in "speech" read the order back (side, qty, symbol, type, price) and ask the user to confirm out loud. Do NOT emit confirm_paper_trade in the same reply as stage_paper_trade — wait for the user's next message to say yes. Only then emit confirm_paper_trade.
3. THIS IS PAPER. All trades are simulated, stored locally, reversible. If the user thinks it's real money, gently correct them.
4. NOT ADVICE. You're a trading co-pilot, not a licensed advisor. If asked for personalized financial advice, say so briefly, then stick to what the chart shows.

STYLE: This is VOICE — keep "speech" SHORT (a sentence or two), plain, no markdown, no emoji, no reading punctuation. When you take an action, say what you did in a few words.`;

const OUTPUT_CONTRACT = `OUTPUT FORMAT — reply with ONLY a single JSON object, nothing else (no markdown, no code fences, no text before or after):
{"speech": "<what to say out loud>", "actions": [{"tool": "<name>", "args": {<args>}}]}
"actions" may be an empty array when you're just talking. Emit multiple actions only when they naturally go together.`;

export function buildSystemPrompt(personaId: PersonaId): string {
  const p = PERSONAS[personaId] ?? PERSONAS[DEFAULT_PERSONA];
  return [
    `You are "LazyBull", a live voice trading co-pilot embedded in the LazyBull Pro charts workspace — a browser trading terminal. The user is looking at a live candlestick chart and talking to you through their speakers. You can SEE the chart via the snapshot you're given each turn, and CONTROL it by emitting actions.`,
    p.tone,
    ACTION_CATALOG,
    RULES,
    OUTPUT_CONTRACT,
  ].join("\n\n");
}

// Everything the workspace currently shows, injected each turn so the model can
// answer "what alerts do I have / what's on my chart / what did I buy" with no
// extra round-trip.
export function buildWorkspaceContext(w: WorkspaceState): ChatMsg {
  return {
    role: "system",
    content:
      `CURRENT WORKSPACE STATE (this is what the user is looking at right now — use it to answer questions about their setup instead of guessing):\n${JSON.stringify(w)}`,
  };
}

// A compact, model-friendly snapshot of the live market state, injected every turn.
export function buildSnapshotContext(a: MarketAnalysis): ChatMsg {
  const snap = {
    symbol: a.symbol,
    name: a.name,
    timeframe: a.timeframe,
    price: a.price,
    // change_pct is measured against change_basis: "day" = prior daily close,
    // "bar" = the previous bar on this timeframe. Null means no reliable
    // baseline — in that case do NOT state a % change at all.
    change_pct: a.changePct,
    change_basis: a.changeBasis,
    trend: a.trend,
    trend_strength: a.trendStrength,
    ema20: a.ema20,
    ema50: a.ema50,
    price_vs_ema20: a.priceVsEma20,
    rsi: a.rsi,
    rsi_label: a.rsiLabel,
    macd_momentum: a.momentum,
    atr_pct: a.atrPct,
    volatility: a.volatility,
    support: a.support,
    resistance: a.resistance,
    near_52w_high: a.nearHigh,
    near_52w_low: a.nearLow,
    volume_vs_avg: a.volumeVsAvg,
    market_state: a.marketState,
  };
  return {
    role: "system",
    content: `LIVE MARKET SNAPSHOT (use ONLY these numbers; prices in the symbol's currency):\n${JSON.stringify(snap)}`,
  };
}

const VALID_TOOLS = new Set([
  // chart
  "set_symbol", "set_timeframe", "set_chart_type", "set_layout", "set_range",
  "zoom_to", "toggle_fullscreen", "snapshot", "save_workspace",
  // indicators
  "add_indicator", "remove_indicator", "clear_indicators",
  // drawing
  "draw_horizontal", "draw_trendline", "draw_fib", "draw_rect", "draw_text",
  "select_tool", "set_color", "clear_drawings", "undo", "redo",
  // alerts
  "create_alert", "delete_alert", "clear_alerts", "open_alerts",
  // replay
  "start_replay", "stop_replay", "set_replay_playing", "set_replay_speed", "replay_seek",
  // watchlist
  "add_to_watchlist", "remove_from_watchlist",
  // trading
  "open_trade_panel", "stage_paper_trade", "confirm_paper_trade", "cancel_staged_trade",
  // lookups (return data)
  "lookup_symbol", "search_symbols",
]);

// Actions that return data the model needs before it can answer properly.
export const DATA_ACTIONS = new Set(["lookup_symbol", "search_symbols"]);

const SAFE_FALLBACK = "Sorry, I glitched for a second — say that again?";
const MAX_SPEECH = 440;

// Cap spoken length at a sentence boundary so a runaway model can't monologue.
function capSpeech(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_SPEECH) return t;
  const cut = t.slice(0, MAX_SPEECH);
  const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (stop > MAX_SPEECH * 0.5 ? cut.slice(0, stop + 1) : cut).trim();
}

// Last-ditch recovery: pull the "speech":"..." value out of near-JSON that
// failed to parse (handles escaped quotes). Never returns braces/keys/brackets.
function recoverSpeech(raw: string): string {
  const m = raw.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return "";
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1].replace(/\\"/g, '"').replace(/\\n/g, " "); }
}

// Defensively pull the JSON reply out of whatever the model returned. On any
// failure we speak a recovered "speech" value or a safe canned line — NEVER the
// raw payload (which would read JSON keys/quotes/braces aloud).
export function parseBrainReply(raw: string): BrainReply {
  const text = (raw || "").trim();
  if (!text) return { speech: "", actions: [] };

  // strip ``` / ```json fences if present
  let body = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // isolate the outermost {...}
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) body = body.slice(start, end + 1);

  try {
    const obj = JSON.parse(body) as { speech?: unknown; actions?: unknown };
    const speech = typeof obj.speech === "string" ? capSpeech(obj.speech) : "";
    const actions: BrainAction[] = Array.isArray(obj.actions)
      ? obj.actions
          .filter((a): a is BrainAction => !!a && typeof a === "object" && typeof (a as BrainAction).tool === "string" && VALID_TOOLS.has((a as BrainAction).tool))
          .map((a) => ({ tool: a.tool, args: (a.args && typeof a.args === "object") ? (a.args as Record<string, unknown>) : {} }))
      : [];
    if (!speech && actions.length === 0) {
      const recovered = recoverSpeech(text);
      return { speech: recovered ? capSpeech(recovered) : SAFE_FALLBACK, actions: [] };
    }
    return { speech, actions };
  } catch {
    // not valid JSON — recover just the spoken line, else say a safe canned line
    const recovered = recoverSpeech(text);
    return { speech: recovered ? capSpeech(recovered) : SAFE_FALLBACK, actions: [] };
  }
}
