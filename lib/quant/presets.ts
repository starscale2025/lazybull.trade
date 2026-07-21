// Per-symbol bot recommendations — WHICH models suit WHICH tape, and why.
//
// These are curated, not computed: each stock has a documented character
// (trend persistence, vol level, reversion behaviour) and each bot has a
// regime it's built for. The why-strings are the product: a beginner should
// read one and understand the match, not just trust it. Honesty rule — a
// "why" must describe the MECHANISM (breakouts, reversion, fat tails), never
// promise returns.

export type PresetBot = { defId: string; why: string };
export type SymbolPreset = {
  /** One line on how this tape actually behaves. */
  character: string;
  bots: PresetBot[];
};

export const SYMBOL_PRESETS: Record<string, SymbolPreset> = {
  AMZN: {
    character: "cyclical trender — long grinds punctuated by earnings gaps",
    bots: [
      { defId: "ai-consensus", why: "six independent models vote — gap-prone tapes punish single-model conviction" },
      { defId: "macd", why: "momentum histogram catches the post-earnings drift AMZN is known for" },
      { defId: "zscore", why: "between catalysts it oscillates around a mean — stretch says how far is too far" },
      { defId: "ai-quantile", why: "p10/p50/p90 range forecast — earnings gaps make point estimates a lie" },
    ],
  },
  AAPL: {
    character: "steady mega-cap — drifts up, mean-reverts around the drift",
    bots: [
      { defId: "rsi-rev", why: "AAPL's dips get bought — oversold bounces are its signature pattern" },
      { defId: "boll", why: "band touches mark the stretch points on a stock that rarely runs away" },
      { defId: "ai-consensus", why: "low-drama tape = low-conviction signals; agreement across models filters noise" },
      { defId: "sma-cross", why: "the slow drift is real — a crossover keeps you on its right side" },
    ],
  },
  NVDA: {
    character: "high-beta secular trender — multi-month runs, violent drawdowns",
    bots: [
      { defId: "donchian", why: "breakouts RUN here — new highs on NVDA historically kept going" },
      { defId: "ai-magnitude", why: "direction is the easy half — this sizes HOW FAR the move should carry" },
      { defId: "sma-cross", why: "trend-following earns its keep on the strongest trender in mega-caps" },
      { defId: "mc-var", why: "its drawdowns are brutal — know the tail loss before you size a position" },
    ],
  },
  TSLA: {
    character: "wildest vol in large-caps — trends hard, then chops violently",
    bots: [
      { defId: "hurst", why: "regime detector first: TSLA flips between trending and chopping — knowing which mode you're in IS the edge" },
      { defId: "donchian", why: "when it trends, breakouts capture the squeeze legs" },
      { defId: "ai-quantile", why: "fat tails both ways — a p10/p90 band is honest where a point forecast isn't" },
      { defId: "mc-var", why: "the widest tails in the list — simulate the downside before betting" },
    ],
  },
  SPY: {
    character: "THE mean-reverting index — short-term dips get bought",
    bots: [
      { defId: "zscore", why: "short-horizon reversion on index dips is the most documented edge in the book" },
      { defId: "rsi-rev", why: "oversold on SPY has historically been a buy signal, not a warning" },
      { defId: "boll", why: "band math suits an index that oscillates instead of gapping" },
      { defId: "sharpe", why: "the benchmark itself — measure risk-adjusted quality, not just direction" },
    ],
  },
  QQQ: {
    character: "tech index — trendier and higher-beta than SPY",
    bots: [
      { defId: "sma-cross", why: "tech's regime moves last months — a crossover rides them with few whipsaws" },
      { defId: "macd", why: "momentum confirmation matters more on the index that actually trends" },
      { defId: "hurst", why: "quantifies the trendiness that separates QQQ from SPY at any moment" },
      { defId: "ai-direction", why: "GBM ensemble votes on the 20-day drift — suits a directional index" },
    ],
  },
  BTC: {
    character: "24/7 tape — historically trend-persistent with extreme vol",
    bots: [
      { defId: "donchian", why: "the classic BTC system: channel breakouts on the most trend-persistent major asset" },
      { defId: "hurst", why: "BTC's H has historically sat above 0.5 — verify the persistence is still there" },
      { defId: "mc-var", why: "50% drawdowns are routine history here — quantify the tail before sizing" },
      { defId: "ai-quantile", why: "a range forecast respects vol that would make any point estimate absurd" },
    ],
  },
  META: {
    character: "momentum name with brutal single-day repricings",
    bots: [
      { defId: "macd", why: "momentum persistence between repricings is where META's edge lives" },
      { defId: "donchian", why: "post-gap continuation shows up as breakout follow-through" },
      { defId: "ai-magnitude", why: "±20% earnings days — expected move size matters as much as direction" },
      { defId: "mc-var", why: "single-day gap risk is the story — measure it explicitly" },
    ],
  },
  MSFT: {
    character: "the steadiest grinder in tech — clean drifts, shallow pullbacks",
    bots: [
      { defId: "sma-cross", why: "the cleanest trends in mega-cap tech — crossovers whipsaw least here" },
      { defId: "linreg", why: "its drifts are so orderly a regression channel actually fits" },
      { defId: "ai-direction", why: "steady tapes give the GBM ensemble its best signal-to-noise" },
      { defId: "sharpe", why: "grind-up names are about efficiency — track return per unit of risk" },
    ],
  },
  GOOG: {
    character: "value-ish mega-cap — long range-bound stretches, sharp re-ratings",
    bots: [
      { defId: "kalman", why: "a fair-value filter suits a stock that oscillates around slow re-ratings" },
      { defId: "zscore", why: "range-bound stretches reward knowing when price is stretched" },
      { defId: "boll", why: "bands frame the range GOOG spends most of its time inside" },
      { defId: "ai-consensus", why: "model agreement helps most when the tape itself is undecided" },
    ],
  },
};

/** Signature for "is the active stack still exactly this preset". */
export const presetSignature = (bots: { defId: string }[]) =>
  bots
    .map((b) => b.defId)
    .sort()
    .join(",");
