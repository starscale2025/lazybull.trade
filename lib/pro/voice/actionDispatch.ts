// Shared action dispatcher for BOTH voice engines (free WebSpeech+OpenRouter and
// paid OpenAI Realtime). Handles every workspace action except the paper-trade
// ones, which need engine-local staging state and live in each engine.
//
// Keeping this in one place means the two engines can never drift apart on what
// the agent is allowed to do.

import type { VoiceActions } from "./useVoiceAgent";
import { INDICATOR_IDS, TIMEFRAMES, CHART_TYPES, RANGE_PRESETS, DRAW_TOOLS } from "./tools";

// Strict coercion. Number() maps null, "", [], true → finite numbers, which
// would sail through every `!= null` guard below and produce nonsense UI state.
const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
// Likewise `x !== false` treated the string "false", 0 and undefined as true.
const bool = (v: unknown, fallback: boolean): boolean => {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
};

// Free models are sloppy about FORMAT ("RSI" not "rsi", "price > 340" not
// {price:340, condition:"above"}). Be forgiving about shape while staying strict
// about facts — otherwise we silently drop commands the user really did give.
const canon = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, "");
const pick = (v: unknown, list: readonly string[]): string | undefined => {
  if (typeof v !== "string") return undefined;
  const c = canon(v);
  return list.find((x) => canon(x) === c);
};
const INDICATOR_ALIASES: Record<string, string> = {
  bollinger: "bb", bollingerbands: "bb", bollingerband: "bb", bands: "bb",
  ema: "ema20", ema20: "ema20", ema50: "ema50", movingaverage: "ema20", ma: "ema20",
  rsi: "rsi", relativestrength: "rsi", relativestrengthindex: "rsi",
  macd: "macd", vwap: "vwap", volumeweighted: "vwap", volumeweightedaverageprice: "vwap",
  ichimoku: "ichimoku", cloud: "ichimoku", ichimokucloud: "ichimoku",
  supertrend: "supertrend",
};
const pickIndicator = (v: unknown): string | undefined =>
  pick(v, INDICATOR_IDS) ?? (typeof v === "string" ? INDICATOR_ALIASES[canon(v)] : undefined);

const NAMED_COLORS: Record<string, string> = {
  red: "#ff4d4d", green: "#00ff87", blue: "#4da6ff", yellow: "#ffd24d",
  orange: "#ff9f4d", purple: "#a78bfa", cyan: "#4dd8ff", white: "#ffffff",
  pink: "#ff7ad9", grey: "#9ca3af", gray: "#9ca3af",
};

// Accept "above"/"below" but also ">", "price > 340", "crosses under", etc.
const pickCondition = (args: Record<string, unknown>): "above" | "below" | undefined => {
  const raw = `${args.condition ?? ""} ${args.direction ?? ""} ${args.side ?? ""}`.toLowerCase();
  if (/(above|over|greater|higher|>|\bup\b|rise|cross(es)? up|breaks? up)/.test(raw)) return "above";
  if (/(below|under|less|lower|<|\bdown\b|fall|drop|cross(es)? down|breaks? down)/.test(raw)) return "below";
  return undefined;
};
// Pull the level out of price/level/target/value, or from a "price > 340" string.
const priceFrom = (args: Record<string, unknown>): number | undefined => {
  const direct = num(args.price) ?? num(args.level) ?? num(args.target) ?? num(args.value);
  if (direct != null) return direct;
  const m = String(args.condition ?? "").match(/-?\d+(?:\.\d+)?/);
  return m ? num(m[0]) : undefined;
};

export type DispatchResult = {
  handled: boolean;
  /** set for lookup actions — the model needs this fed back before it can answer */
  data?: unknown;
  /** short human-readable note for the transcript/debug */
  note?: string;
  /** true when the action was understood but its arguments were unusable */
  failed?: boolean;
};

export async function dispatchSimpleAction(
  tool: string,
  args: Record<string, unknown>,
  A: VoiceActions,
): Promise<DispatchResult> {
  switch (tool) {
    // ── chart ──────────────────────────────────────────────────────────
    case "set_symbol": {
      const t = String(args.ticker ?? "").trim();
      if (!t) return { handled: true, note: "no ticker" };
      const r = await A.setSymbolByTicker(t);
      return { handled: true, note: r.ok ? `symbol → ${r.symbol}` : r.error };
    }
    case "set_timeframe": {
      const tf = pick(args.timeframe, TIMEFRAMES);
      if (!tf) return { handled: true, failed: true, note: `unknown timeframe ${String(args.timeframe)}` };
      A.setTimeframe(tf);
      return { handled: true };
    }
    case "set_chart_type": {
      const c = pick(args.chart, CHART_TYPES);
      if (!c) return { handled: true, failed: true, note: `unknown chart type ${String(args.chart)}` };
      A.setChartType(c);
      return { handled: true };
    }
    case "set_layout": {
      const n = num(args.panes);
      if (n && n >= 1 && n <= 4) A.setLayout(Math.round(n));
      return { handled: true };
    }
    case "set_range": {
      const p = pick(args.preset, RANGE_PRESETS);
      if (!p) return { handled: true, failed: true, note: `unknown range ${String(args.preset)}` };
      A.setRangePreset(p);
      return { handled: true };
    }
    case "zoom_to": {
      const n = num(args.bars);
      if (n && n > 0) A.zoomTo(Math.min(100_000, n));
      return { handled: true };
    }
    case "toggle_fullscreen": A.toggleFullscreen(); return { handled: true };
    case "snapshot": A.snapshot(); return { handled: true };
    case "save_workspace": A.saveWorkspace(); return { handled: true };

    // ── indicators ─────────────────────────────────────────────────────
    case "add_indicator": {
      const id = pickIndicator(args.indicator);
      if (!id) return { handled: true, failed: true, note: `unknown indicator ${String(args.indicator)}` };
      A.addIndicator(id);
      return { handled: true };
    }
    case "remove_indicator": {
      const id = pickIndicator(args.indicator);
      if (!id) return { handled: true, failed: true, note: `unknown indicator ${String(args.indicator)}` };
      A.removeIndicator(id);
      return { handled: true };
    }
    case "clear_indicators": A.clearIndicators(); return { handled: true };

    // ── drawing ────────────────────────────────────────────────────────
    case "draw_horizontal": {
      const p = num(args.price);
      if (p != null) A.drawHorizontal(p);
      return { handled: true };
    }
    case "draw_trendline": {
      const f = num(args.from_price), t = num(args.to_price);
      if (f != null && t != null) A.drawTrendline(f, t, num(args.from_bars_ago), num(args.to_bars_ago));
      return { handled: true };
    }
    case "draw_fib": {
      const f = num(args.from_price), t = num(args.to_price);
      if (f != null && t != null) A.drawFib(f, t);
      return { handled: true };
    }
    case "draw_rect": {
      const f = num(args.from_price), t = num(args.to_price);
      if (f != null && t != null) A.drawRect(f, t, num(args.from_bars_ago), num(args.to_bars_ago));
      return { handled: true };
    }
    case "draw_text": {
      const p = num(args.price);
      const txt = String(args.text ?? "").trim();
      if (p != null && txt) A.drawText(p, txt, num(args.bars_ago));
      return { handled: true };
    }
    case "select_tool": {
      const t = pick(args.tool, DRAW_TOOLS);
      if (!t) return { handled: true, failed: true, note: `unknown tool ${String(args.tool)}` };
      A.selectTool(t);
      return { handled: true };
    }
    case "set_color": {
      const raw = String(args.color ?? "").trim();
      const hex = /^#[0-9a-f]{6}$/i.test(raw) ? raw : NAMED_COLORS[canon(raw)];
      if (!hex) return { handled: true, failed: true, note: `unknown colour ${raw}` };
      A.setColor(hex);
      return { handled: true };
    }
    case "clear_drawings": A.clearDrawings(); return { handled: true };
    case "undo": A.undo(); return { handled: true };
    case "redo": A.redo(); return { handled: true };

    // ── alerts ─────────────────────────────────────────────────────────
    case "create_alert": {
      const p = priceFrom(args);
      if (p == null) return { handled: true, failed: true, note: "alert needs a price level" };
      const cond = pickCondition(args);
      if (!cond) return { handled: true, failed: true, note: "alert needs 'above' or 'below'" };
      A.createAlert(p, cond, args.note ? String(args.note) : undefined);
      return { handled: true };
    }
    case "delete_alert": {
      const p = priceFrom(args);
      if (p == null) return { handled: true, failed: true, note: "delete_alert needs a price" };
      return { handled: true, note: A.deleteAlert(p) ? "alert removed" : "no alert near that price" };
    }
    case "clear_alerts": A.clearAlerts(); return { handled: true };
    case "open_alerts": A.openAlerts(bool(args.open, true)); return { handled: true };

    // ── replay ─────────────────────────────────────────────────────────
    case "start_replay": A.startReplay(); return { handled: true };
    case "stop_replay": A.stopReplay(); return { handled: true };
    case "set_replay_playing": A.setReplayPlaying(bool(args.playing, true)); return { handled: true };
    case "set_replay_speed": {
      const s = num(args.speed);
      if (s != null) A.setReplaySpeed(s);
      return { handled: true };
    }
    case "replay_seek": {
      const to = num(args.to), step = num(args.step);
      if (to == null && step == null) return { handled: true, note: "need `to` or `step`" };
      A.replaySeek({ to, step });
      return { handled: true };
    }

    // ── watchlist ──────────────────────────────────────────────────────
    case "add_to_watchlist": {
      const t = String(args.ticker ?? "").trim();
      if (t) A.addToWatchlist(t);
      return { handled: true };
    }
    case "remove_from_watchlist": {
      const t = String(args.ticker ?? "").trim();
      if (t) A.removeFromWatchlist(t);
      return { handled: true };
    }

    // ── trading panel (the ORDER actions are engine-local) ─────────────
    case "open_trade_panel": A.openTradePanel(bool(args.open, true)); return { handled: true };

    // ── lookups (return data for a follow-up answer) ───────────────────
    case "lookup_symbol": {
      const t = String(args.ticker ?? "").trim();
      if (!t) return { handled: true, note: "no ticker" };
      return { handled: true, data: await A.lookupSymbol(t) };
    }
    case "search_symbols": {
      const q = String(args.query ?? "").trim();
      if (!q) return { handled: true, note: "no query" };
      return { handled: true, data: await A.searchSymbols(q) };
    }

    default:
      return { handled: false };
  }
}
