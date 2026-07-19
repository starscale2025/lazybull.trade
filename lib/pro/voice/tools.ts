// Tool (function-call) schemas the Realtime model is allowed to invoke, in the
// current OpenAI Realtime GA shape: { type:"function", name, description, parameters }.
// The runtime dispatch for each of these lives in useVoiceAgent.ts.

export const INDICATOR_IDS = ["ema20", "ema50", "rsi", "macd", "bb", "vwap", "ichimoku", "supertrend"] as const;
export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "D", "W", "M"] as const;
export const CHART_TYPES = ["candles", "line", "area", "bars"] as const;
export const RANGE_PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"] as const;
export const DRAW_TOOLS = [
  "cursor", "trendline", "horizontal", "ray", "rect", "fib",
  "channel", "text", "brush", "measure", "callout", "eraser",
] as const;

export type RealtimeTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const VOICE_TOOLS: RealtimeTool[] = [
  {
    type: "function",
    name: "get_market_analysis",
    description:
      "Read the live market state for the symbol currently on the chart: price, % change, trend direction & strength, RSI, MACD momentum, support/resistance, volatility, volume, and 52-week context. Call this before quoting any number.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "set_symbol",
    description: "Change the chart to a different ticker (e.g. AAPL, NVDA, BTC-USD, SPY). Resolves the ticker via search.",
    parameters: {
      type: "object",
      properties: { ticker: { type: "string", description: "Ticker symbol or company name to look up." } },
      required: ["ticker"],
    },
  },
  {
    type: "function",
    name: "set_timeframe",
    description: "Change the chart timeframe.",
    parameters: {
      type: "object",
      properties: { timeframe: { type: "string", enum: [...TIMEFRAMES] } },
      required: ["timeframe"],
    },
  },
  {
    type: "function",
    name: "set_chart_type",
    description: "Switch how the chart is drawn.",
    parameters: {
      type: "object",
      properties: { chart: { type: "string", enum: [...CHART_TYPES] } },
      required: ["chart"],
    },
  },
  {
    type: "function",
    name: "set_layout",
    description: "Set how many chart panes are shown, 1 through 4.",
    parameters: {
      type: "object",
      properties: { panes: { type: "integer", minimum: 1, maximum: 4 } },
      required: ["panes"],
    },
  },
  {
    type: "function",
    name: "add_indicator",
    description: "Add a technical indicator overlay/pane to the chart.",
    parameters: {
      type: "object",
      properties: { indicator: { type: "string", enum: [...INDICATOR_IDS] } },
      required: ["indicator"],
    },
  },
  {
    type: "function",
    name: "remove_indicator",
    description: "Remove a technical indicator from the chart.",
    parameters: {
      type: "object",
      properties: { indicator: { type: "string", enum: [...INDICATOR_IDS] } },
      required: ["indicator"],
    },
  },
  {
    type: "function",
    name: "create_alert",
    description: "Create a price alert that fires when price crosses a level.",
    parameters: {
      type: "object",
      properties: {
        price: { type: "number", description: "The price level to watch." },
        condition: { type: "string", enum: ["above", "below"] },
        note: { type: "string", description: "Optional short note for the alert." },
      },
      required: ["price", "condition"],
    },
  },
  // ── chart view ──
  {
    type: "function",
    name: "set_range",
    description: "Set the visible date range of the chart.",
    parameters: { type: "object", properties: { preset: { type: "string", enum: [...RANGE_PRESETS] } }, required: ["preset"] },
  },
  {
    type: "function",
    name: "zoom_to",
    description: "Zoom the chart to fit the last N bars.",
    parameters: { type: "object", properties: { bars: { type: "integer", minimum: 5 } }, required: ["bars"] },
  },
  { type: "function", name: "toggle_fullscreen", description: "Toggle fullscreen for the workspace.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "save_workspace", description: "Save / share the current workspace layout.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "clear_indicators", description: "Remove all indicators from the chart.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "get_workspace_state", description: "Read back everything currently on screen: symbol, timeframe, indicators, drawings, alerts, orders, watchlist, replay state.", parameters: { type: "object", properties: {}, required: [] } },

  // ── drawing ──
  {
    type: "function",
    name: "draw_horizontal",
    description: "Draw a horizontal support/resistance line at a price.",
    parameters: { type: "object", properties: { price: { type: "number" } }, required: ["price"] },
  },
  {
    type: "function",
    name: "draw_trendline",
    description: "Draw a trendline between two points. *_bars_ago counts back from the newest bar (0 = now).",
    parameters: {
      type: "object",
      properties: {
        from_price: { type: "number" }, to_price: { type: "number" },
        from_bars_ago: { type: "integer" }, to_bars_ago: { type: "integer" },
      },
      required: ["from_price", "to_price"],
    },
  },
  {
    type: "function",
    name: "draw_fib",
    description: "Draw a Fibonacci retracement between two prices.",
    parameters: { type: "object", properties: { from_price: { type: "number" }, to_price: { type: "number" } }, required: ["from_price", "to_price"] },
  },
  {
    type: "function",
    name: "draw_rect",
    description: "Draw a rectangle zone between two prices.",
    parameters: {
      type: "object",
      properties: {
        from_price: { type: "number" }, to_price: { type: "number" },
        from_bars_ago: { type: "integer" }, to_bars_ago: { type: "integer" },
      },
      required: ["from_price", "to_price"],
    },
  },
  {
    type: "function",
    name: "draw_text",
    description: "Place a text label on the chart at a price.",
    parameters: { type: "object", properties: { price: { type: "number" }, text: { type: "string" }, bars_ago: { type: "integer" } }, required: ["price", "text"] },
  },
  {
    type: "function",
    name: "select_tool",
    description: "Select a drawing tool for the user to use by hand.",
    parameters: { type: "object", properties: { tool: { type: "string", enum: [...DRAW_TOOLS] } }, required: ["tool"] },
  },
  {
    type: "function",
    name: "set_color",
    description: "Set the drawing colour as a hex code like #00ff87.",
    parameters: { type: "object", properties: { color: { type: "string" } }, required: ["color"] },
  },
  { type: "function", name: "clear_drawings", description: "Erase all drawings.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "undo", description: "Undo the last drawing change.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "redo", description: "Redo the last undone drawing change.", parameters: { type: "object", properties: {}, required: [] } },

  // ── alerts ──
  {
    type: "function",
    name: "delete_alert",
    description: "Delete the alert nearest a given price.",
    parameters: { type: "object", properties: { price: { type: "number" } }, required: ["price"] },
  },
  { type: "function", name: "clear_alerts", description: "Delete all price alerts.", parameters: { type: "object", properties: {}, required: [] } },
  {
    type: "function",
    name: "open_alerts",
    description: "Open or close the alerts panel.",
    parameters: { type: "object", properties: { open: { type: "boolean" } }, required: ["open"] },
  },

  // ── replay ──
  {
    type: "function",
    name: "start_replay",
    description: "Arm the bar-replay mode so the user can scrub the tape forward.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  { type: "function", name: "stop_replay", description: "Exit bar-replay mode.", parameters: { type: "object", properties: {}, required: [] } },
  {
    type: "function",
    name: "set_replay_playing",
    description: "Play or pause the replay.",
    parameters: { type: "object", properties: { playing: { type: "boolean" } }, required: ["playing"] },
  },
  {
    type: "function",
    name: "set_replay_speed",
    description: "Set replay speed, 1 (slow) to 10 (fast).",
    parameters: { type: "object", properties: { speed: { type: "integer", minimum: 1, maximum: 10 } }, required: ["speed"] },
  },
  {
    type: "function",
    name: "replay_seek",
    description: "Jump the replay to a bar index, or step forward/back by N bars.",
    parameters: { type: "object", properties: { to: { type: "integer" }, step: { type: "integer" } }, required: [] },
  },

  // ── watchlist / trading panel ──
  {
    type: "function",
    name: "add_to_watchlist",
    description: "Add a ticker to the watchlist.",
    parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    type: "function",
    name: "remove_from_watchlist",
    description: "Remove a ticker from the watchlist.",
    parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    type: "function",
    name: "open_trade_panel",
    description: "Open or close the paper-trading drawer.",
    parameters: { type: "object", properties: { open: { type: "boolean" } }, required: ["open"] },
  },

  // ── lookups ──
  {
    type: "function",
    name: "lookup_symbol",
    description: "Get price/trend/RSI for ANOTHER ticker without changing the chart. Use for 'how's TSLA doing?'.",
    parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    type: "function",
    name: "search_symbols",
    description: "Search for tickers by company name or partial symbol.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    type: "function",
    name: "snapshot",
    description: "Capture a PNG snapshot of the current chart.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "stage_paper_trade",
    description:
      "STAGE a simulated (paper) order for confirmation — this does NOT place it. After calling, read the returned summary back to the user and ask them to confirm out loud before calling confirm_paper_trade.",
    parameters: {
      type: "object",
      properties: {
        side: { type: "string", enum: ["buy", "sell"] },
        quantity: { type: "number", description: "Number of shares/units." },
        order_type: { type: "string", enum: ["market", "limit"] },
        limit_price: { type: "number", description: "Required only for limit orders." },
      },
      required: ["side", "quantity", "order_type"],
    },
  },
  {
    type: "function",
    name: "confirm_paper_trade",
    description: "Place the currently staged paper order. Only call this AFTER the user has verbally confirmed.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "cancel_staged_trade",
    description: "Discard the currently staged paper order without placing it.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];
