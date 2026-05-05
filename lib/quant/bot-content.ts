// Hand-written specialty / FAQ content layered on top of the auto-derived
// BotDef fields. Every bot has an entry. The per-bot Learn page reads this
// dictionary; if a bot is missing here it falls through to category defaults.

export type BotContent = {
  /** Tech/quant-fluent intro paragraph. Already written for every bot. */
  intro?: string;
  /** Plain-English version. Read-it-to-a-12-year-old level. Every bot has one. */
  simple?: string;
  shines?: string[];
  fails?: string[];
  verdict?: string;
  faq?: { q: string; a: string }[];
  related?: string[];
};

/** Plain-English version of every bot's pitch. ELI12 — read-it-to-a-12-year-old.
 * If a bot's BOT_CONTENT entry has its own `simple`, that wins over this map. */
export const BOT_SIMPLE: Record<string, string> = {
  // ─────────────── AI QUANTS ───────────────
  "ai-consensus":
    "Six different AI judges look at the same stock and each one votes 'up' or 'down' for the next month. If 5 or 6 of them agree, that's a strong signal worth taking seriously. If they're split 3-3, the market is genuinely confused and the smart move is to do nothing. The card shows you who voted and how confident the group is.",
  "ai-direction":
    "An AI brain made of 7 little decision-tree models, each guessing whether the price will go up or down 20 days from now. We average their guesses to get one probability. When the little models all agree (low spread), trust the answer more. When they disagree, they're guessing — sit it out.",
  "ai-magnitude":
    "Direction tells you which way the price will move. This bot tells you how big the move will be. A 0.5% move is just noise. A 5% move is real. The size of the predicted move IS the conviction.",
  "ai-quantile":
    "Most predictors give you one number. This one gives three: best case, worst case, and middle. If even the worst case is positive, that's a strong long signal. If even the best case is negative, that's a strong short. Anything in between, sit it out.",
  "ai-transformer":
    "The same kind of AI that powers ChatGPT — but instead of reading words, this one reads a whole year of price data. It learns to focus on the important days (earnings, big drops, regime shifts) and uses them to guess the next month's move.",
  "ai-sequence":
    "A small AI model that looks at the last 60 days of prices like a picture and learns to spot familiar shapes — breakouts, coils, head-and-shoulders. It doesn't know the names of these patterns, it just notices the ones that tend to come before big moves.",
  "ai-triple-barrier":
    "A smarter way to label what happened on a trade. Instead of asking 'was the price up in 20 days?', ask 'did it hit my profit target before it hit my stop, or did neither happen?' Three outcomes, three labels. Better-labelled training data makes for smarter models.",
  "ai-bs-surrogate":
    "Pricing options the textbook way is slow when you're doing thousands at once. We trained a tiny AI to mimic the textbook formula. It's just as accurate but lightning fast — and it returns the price plus all 5 'Greeks' (sensitivities to spot, time, vol, etc.) in one shot.",
  "ai-iv-solver":
    "When you see an option's price, you can run the math backwards to figure out what volatility the market is implying. The classic way (Newton-Raphson) is finicky and breaks near zero. Our AI does it in a single forward pass — fast and stable.",
  "ai-mc-surrogate":
    "We simulated 100,000 random price paths and averaged the option's payout. Then we trained a network to mimic those answers — so now you get the same result without rerunning the simulation every time.",
  "ai-american":
    "American options can be cashed in any time before expiry. That extra freedom is worth a tiny bit more than European-style options (cashed only at expiry). The AI learned exactly how much.",
  "ai-heston":
    "Real markets don't have one fixed volatility — vol moves around too. Heston is the gold-standard model that simulates that, including the negative correlation that makes puts more expensive than calls. We trained an AI to price it instantly.",

  // ─────────────── TREND ───────────────
  "sma-cross":
    "Two moving averages chase each other across the chart. A fast one (recent prices) and a slow one (older prices). When the fast one cuts up through the slow one, the trend just turned bullish — buy. When it falls below, the trend rolled over — sell. Old, simple, surprisingly hard to beat in trending markets.",
  "rsi-rev":
    "RSI is a 0-to-100 thermometer. Below 30 means everyone panic-sold and the price will probably bounce. Above 70 means everyone's cheering and a pullback is overdue. The bot fires BUY when RSI exits the oversold zone and SELL when it exits overbought.",
  "macd":
    "MACD asks: is momentum waking up or running out of steam? It looks at the difference between two trend-followers. When that difference flips from negative to positive, momentum just turned on — buy. When it flips negative, it's running out — sell.",
  "donchian":
    "Drew lines through the highest high and lowest low of the last 20 days. When price punches above the top line, the herd just turned bullish — buy. When it falls below the bottom, bears took over — sell. The Turtle Traders made fortunes on this rule in the 1980s.",
  "boll":
    "Two rubber bands stretched a few standard deviations away from the average price. When price stretches one and snaps back, that's the trade. Wider bands mean the market is jittery; narrow bands mean a big move is coming.",

  // ─────────────── STATS ───────────────
  "zscore":
    "Z-score asks: how unusual is today's price compared to recent days? A z of -2 means 'cheaper than 97% of recent prices.' Most things drift back to average — so when the price gets weirdly cheap, buy; when it gets weirdly expensive, sell.",
  "hurst":
    "One number that tells you what kind of market you're in. Above 0.5 = trends keep going (use trend bots). Below 0.5 = prices keep snapping back (use reversion bots). Around 0.5 = random, no edge today, save your money.",
  "kalman":
    "A Kalman filter is what guides your phone's GPS — it blends what it expects with what it sees. Here it tracks the 'true' price hiding under the noise. When today's price wanders far from that filtered fair value, it tends to come back.",
  "linreg":
    "Draws the best-fit straight line through recent prices, then puts dotted lines a few standard deviations above and below. Touching the top line is overextended — sell. Touching the bottom is washed-out — buy.",

  // ─────────────── RISK ───────────────
  "kelly":
    "Kelly tells you how much of your money to risk per trade so it grows fastest without ever hitting zero. The math takes your win odds and your win/loss size and gives back the optimal bet fraction. Most pros use half-Kelly because full Kelly accepts giant drawdowns.",
  "mc-var":
    "Run thousands of simulated 'next 10 days' for the stock. The 5th-worst outcome out of 100 is your Value-at-Risk — the bad day you should plan to survive. Helps you size positions so a normal bad day doesn't blow up your account.",
  "sharpe":
    "Sharpe is your return divided by how bumpy the ride was. Above 1 is good, above 2 is rare, above 3 is suspicious. Sortino is the same idea but only counts the bumps that hurt (downside vol). The simplest 'is this strategy any good?' number that exists.",

  // ─────────────── OPTIONS ───────────────
  "bs-solver":
    "Plug in 5 numbers (spot, strike, days, IV, rate), get the textbook fair price of an option plus all 5 Greeks. The Greeks are the option's vital signs: how sensitive its price is to the stock moving, time passing, and vol changing. Memorise these — every options trader knows them by heart.",
  "iv-crush":
    "Before earnings, options get expensive because nobody knows what'll happen. The instant the news drops, that uncertainty (volatility) collapses — and options lose value even if the stock moves your way. This bot tells you exactly how much you'd lose to vol crush before any directional move.",
  "wheel":
    "The patient income trade. Sell cash-secured puts on a stock you wouldn't mind owning. If you get assigned, flip and sell calls against the shares. Premium income drips in every cycle. Time is on your side.",
};

export const BOT_CONTENT: Record<string, BotContent> = {
  // ─────────────── AI QUANTS ───────────────

  "ai-consensus": {
    intro:
      "Six AI models look at the same stock and vote on direction. The card shows you their tally, the agreement tier, and the historical accuracy band that tier earns out-of-sample. The single most useful AI bot in the workbench — when you see ULTRA tier, you've got something real.",
    shines: [
      "Liquid US large-caps (AAPL, NVDA, AMZN, SPY) where macro context is rich and per-asset training data is plentiful.",
      "Stable volatility regimes — the models were trained on bands, not regime shifts.",
      "Multi-week horizons (20-day default). Same-day or next-day prediction is much noisier.",
      "When ≥5 of 6 models agree. The agreement is the signal; opinion alone is cheap.",
    ],
    fails: [
      "Regime breaks. COVID-era March 2020, the 2022 rate cycle, post-earnings gaps — the ensemble was fit on smoother periods.",
      "Tickers Yahoo doesn't have rich data for. The Python side needs ≥250 historical bars to build features.",
      "Crypto and FX. The training basket is US equities; out-of-distribution.",
      "Split votes. When 3-3 or 4-2, the consensus number is essentially noise — the bot will say SPLIT and that's the right answer.",
    ],
    verdict:
      "BUY/SELL only fire when ≥5 models lean the same way AND the average expected magnitude clears 4%. Otherwise it's HOLD. The confidence number is the agreement fraction × the magnitude clearing. ULTRA tier maps to ~65–77% historical accuracy, HIGH to 60–66%, MEDIUM to 55–60%, LOW to ≤55%.",
    faq: [
      {
        q: "Why does the consensus give the same answer for AAPL and TSLA?",
        a: "If you see Source: Mock on the card, the FastAPI service is offline and you're getting a deterministic seeded fallback that depends only on the synthetic chart. Start uvicorn (cd \"ai quants\" && uvicorn serve:app --port 8000) and refresh — Source flips to Python NN and AAPL/TSLA each get their own real predictions.",
      },
      {
        q: "What's the historical accuracy?",
        a: "Embargoed walk-forward CV on US large caps: ULTRA tier (6/6 agree + |magnitude| > 4%) lands ~65–77%; HIGH tier (≥5 agree) lands 60–66%; MEDIUM (≥4) lands 55–60%; below that it's not tradeable. These bands are conservative — production models tend to drift down 2-4 pts when the regime shifts.",
      },
      {
        q: "Can I use this for day trades?",
        a: "No. The horizon is 20 trading days. Models trained on monthly windows have terrible variance on intraday calls. For day trading, the 1D CNN bot is closer (60-bar lookback) but still not really designed for sub-day.",
      },
    ],
    related: ["ai-direction", "ai-magnitude", "ai-quantile"],
  },

  "ai-direction": {
    intro:
      "An ensemble of 7-14 boosted-tree models, each predicting whether the stock closes up or down 20 days from now. The probability is the mean of their votes; the conviction band reflects how much that probability deviates from the 0.5 noise floor. Lower ensemble σ = trees agree = higher trust.",
    shines: [
      "Names with strong macro coupling (SPY, QQQ, AAPL). The features include cross-asset signals — VIX, DXY, 10Y, WTI — that anchor the prediction.",
      "Mid-cycle markets. The models see lots of those in training and generalise well.",
      "When ensemble σ is low (<0.05). That means the trees agree; you're not betting on a single fluky leaf.",
    ],
    fails: [
      "Earnings windows. The model treats the 20-day horizon as homogeneous, but earnings can flip the sign in a single bar.",
      "Illiquid tickers. Need ≥250 bars; small-caps with thin history under-perform.",
      "Tail events. The labels were clipped at the 99th percentile — the model literally hasn't seen 2020 March.",
    ],
    verdict:
      "BUY at p_up > 0.6, SELL at p_up < 0.4, HOLD in between. Conviction band classifies that probability into LOW / HIGH / EXTREME / ULTRA, and the historical accuracy of each band is published on the card.",
    faq: [
      {
        q: "What features does it use?",
        a: "Per-asset: returns over 5/10/20/60/252 days, realized vol, RSI, MACD, distance-from-MA, regime flags. Cross-asset: VIX, DXY, 10Y rate, oil. ~40 features in total, fed into a HistGradientBoostingClassifier ensemble.",
      },
      {
        q: "Why ensemble of 7 instead of 1?",
        a: "Variance reduction. A single GBM has noisy decisions near the threshold; the mean of 7 differently-seeded models is much more stable. The σ across the ensemble doubles as a confidence proxy — when σ is high, we know the trees are guessing.",
      },
    ],
    related: ["ai-consensus", "ai-magnitude", "ai-quantile"],
  },

  "ai-magnitude": {
    intro:
      "Direction's quieter sibling. Instead of asking 'up or down?', it predicts the size of the next 20-day move. A 0.5% expected return is meaningless noise; a 5% expected return is a real signal worth sizing up on. The sign tells you direction, the magnitude tells you conviction.",
    shines: [
      "Position sizing decisions. Direction alone tells you which way to bet; magnitude tells you how much.",
      "Filtering Direction Ensemble's signals — when both bots agree on direction AND magnitude clears 3%, it's a stronger setup than either alone.",
      "Names with persistent edges (sector ETFs, large-cap growth). The regression learns dampened magnitudes that match real return distributions.",
      "When 'macro features' is on. VIX and 10Y rate alignment lifts accuracy by ~2pts.",
    ],
    fails: [
      "Turning points. Regression smooths over inflections; magnitude underestimates reversals.",
      "High-vol assets. The MSE objective penalises large errors disproportionately, so the model under-bets on tail moves.",
      "Out-of-distribution names. Like Direction, needs ≥250 bars and US-equity-shaped data.",
    ],
    verdict:
      "BUY when expected return > +2%, SELL when < -2%, HOLD in between. Magnitude band classifies |expRet| into LOW (<1.5%), MEDIUM (1.5-2.7%), HIGH (2.7-4.5%), EXTREME (4.5-7%), ULTRA (>7%). Confidence scales linearly with |expRet| up to a cap of 1.0 at 8%.",
    faq: [
      {
        q: "What's the difference between this and Direction Ensemble?",
        a: "Direction is a binary classifier — its output is P(up). This is a regression — its output is expected return. They use different loss functions, different model architectures, and different conviction bands. Stack both and use the agreement.",
      },
      {
        q: "Why does it sometimes contradict Direction?",
        a: "Different objective functions. Classification is forced to commit to a side; regression can output a number near zero. When they disagree, the magnitude is usually small and HOLD is the right call.",
      },
    ],
    related: ["ai-direction", "ai-consensus", "ai-quantile"],
  },

  "ai-quantile": {
    intro:
      "Most predictors give you one number. This bot gives three — the 10th, 50th, and 90th percentile of the 20-day return distribution. That's a real confidence interval. If even the worst-case (p10) is positive, you've got a clean long signal. If even the best-case (p90) is negative, that's a clean short. Anything in between, sit it out.",
    shines: [
      "Risk-aware decisions. The width of the interval tells you how confident the model is — narrow CI = confident, wide CI = market is genuinely uncertain.",
      "Liquid names where the underlying return distribution is well-behaved (ETFs, large-caps).",
      "Combined with Kelly sizing. The p10 and p90 give you natural inputs for an EV calculation.",
      "Periods of expanding volatility. Quantile regression handles heteroskedastic returns better than a point estimate.",
    ],
    fails: [
      "Highly skewed return distributions. The pinball loss assumes the conditional CDF is well-defined; broken at the extremes.",
      "Small datasets. Each quantile has its own model; need lots of data to estimate p10 and p90 reliably.",
      "Tail events. p10 still under-estimates true downside in a 6-sigma move.",
    ],
    verdict:
      "BUY (long) only when p10 > 0 — the entire 80% interval clears zero. SELL (short) only when p90 < 0. Otherwise FLAT (HOLD). Confidence is 0.85 when the bot fires, 0.2 when flat. Width of the interval is published on the card and is the single best 'how uncertain is the market?' indicator we have.",
    faq: [
      {
        q: "Why three quantiles instead of mean ± std?",
        a: "Returns aren't Gaussian. Mean ± 2σ implies a symmetric distribution; quantiles let the model learn whatever shape the data actually has. p10 isn't necessarily mirror-image of p90 — that asymmetry is real information about skew.",
      },
      {
        q: "What's pinball loss?",
        a: "The loss function for quantile regression. For the 0.9 quantile, it penalises predictions that are too low much more than too high. The opposite for 0.1. That's how the model learns to honestly estimate tails instead of just the mean.",
      },
    ],
    related: ["ai-direction", "ai-magnitude", "mc-var"],
  },

  "ai-transformer": {
    intro:
      "A Transformer encoder — same architecture that made ChatGPT work — but fed a year of OHLCV data instead of text tokens. It learns to attend to the right days: earnings prints, vol spikes, regime changes. Predicts the next 20-day return purely from raw price/volume shape. No hand-engineered features.",
    shines: [
      "Long-horizon patterns: seasonality, regime detection, post-earnings drift. The 252-day window covers a full annual cycle.",
      "Names with rich price history and multiple regime episodes (SPY, AAPL, JPM). The attention learns which past contexts are similar to today's.",
      "When you don't trust hand-crafted features. The model learns its own representations end-to-end.",
    ],
    fails: [
      "Small data regimes. Transformers need lots of examples — small caps with patchy history struggle.",
      "Out-of-distribution market structure. Crypto's 24/7 trading and crypto-native cycles are not in the training set.",
      "Latency-sensitive use cases. A forward pass on a 252-day sequence is fast on GPU, slower on CPU; the bot is ~50ms in our setup.",
    ],
    verdict:
      "BUY when expected return > +1.5%, SELL when < -1.5%, HOLD in between. Confidence scales with |pred|. The 'vol regime' chip on the card is a useful sanity check: in high-vol regimes the model under-bets, which is the right behavior.",
    faq: [
      {
        q: "What makes this different from the 1D CNN?",
        a: "CNN sees 60 bars; this sees 252. CNN learns local patterns (cup-and-handle, breakouts); this learns global context (where in the cycle are we?). They complement each other — that's why both feed into the 6-Model Consensus.",
      },
      {
        q: "Why a Transformer for 252 numbers?",
        a: "Self-attention scales O(n²) with sequence length, which is fine at 252. The point isn't size — it's that attention learns which past days matter for predicting the next move. A linear model can't tell you 'today resembles April 2018'; this can.",
      },
    ],
    related: ["ai-sequence", "ai-direction", "ai-consensus"],
  },

  "ai-sequence": {
    intro:
      "A 1D convolutional neural network that reads the last 60 days of OHLCV like an image and outputs an expected return. CNNs are translation-invariant by design — meaning the same pattern at the start, middle, or end of the window gets recognised. It learns recurring chart shapes (breakouts, coils, head-and-shoulders) without anyone telling it what they are.",
    shines: [
      "Pattern-driven traders. The CNN is essentially an automated chartist. It picks up on shapes that human eyes also notice but can't formalise.",
      "Short-to-medium horizon (~20 days). The 60-bar window naturally caps how far back it can look.",
      "Pairs nicely with classical indicators — the CNN catches what RSI/MACD don't.",
    ],
    fails: [
      "Slow-moving fundamentals. The network can't see beyond 60 bars; it's blind to anything older.",
      "Noisy intraday data. Designed for daily bars; minute data is too noisy for 60-step convolutions.",
      "Names with little visual structure (treasuries, low-vol utilities). Not enough shape variation.",
    ],
    verdict:
      "BUY when expected return > +1.5%, SELL when < -1.5%, HOLD in between. The 'detected pattern' chip (uptrend / downtrend / chop) is a sanity-check label, not a formal classifier output — it's derived from recent trend strength.",
    faq: [
      {
        q: "Why CNN instead of LSTM?",
        a: "CNNs are 5-10× faster to train and inference, translation-invariant, and on price data they perform comparably to LSTMs. We tried both; CNN won on pareto-front.",
      },
      {
        q: "What does the model see, exactly?",
        a: "A 60×5 tensor: 60 bars of [open, high, low, close, volume], normalised by the last bar's price and average volume. Then three Conv1d layers, global average pooling, one linear head to a single scalar (the expected return).",
      },
    ],
    related: ["ai-transformer", "ai-direction", "ai-magnitude"],
  },

  "ai-triple-barrier": {
    intro:
      "Marcos López de Prado's labelling method, productionised. Instead of asking 'will the stock be up in 20 days?', it asks 'will it hit my +5% profit target before it hits my -5% stop, or will neither happen and I time out?' Three barriers, three labels. Better-shaped training data → smarter downstream models.",
    shines: [
      "Strategy research. If you're building your own bots, this shows you what de Prado-style labels look like for your asset.",
      "Stop-loss design. The PT/SL multiplier on the card lets you see how the label changes as you tighten or loosen barriers.",
      "Variable-volatility regimes. The σ-scaled barriers adapt automatically.",
    ],
    fails: [
      "No FastAPI endpoint yet. This bot is currently mock-only — the TS surrogate uses the same hash-derived seed as the other AI bots. Will be wired to the trained model in the next sprint.",
      "Asymmetric setups. The current implementation uses symmetric profit/stop multipliers; real systems often want asymmetric.",
    ],
    verdict:
      "Reports three probabilities — P(profit target hit), P(stop hit), P(time-out). Most-likely label classifies into +1 (TP), -1 (SL), or 0 (TO). BUY when P(profit) > 1.4× P(stop), SELL when reverse, HOLD otherwise.",
    faq: [
      {
        q: "Why triple-barrier labels instead of fixed-horizon?",
        a: "Fixed-horizon labels assume the trade is alive for the full window — which isn't how anyone actually trades. Real systems use stops and targets. Triple-barrier labels mirror that, so the model learns to predict the realistic outcome.",
      },
      {
        q: "Should I use this directly or feed it into a classifier?",
        a: "It's the labels that matter. The bot here is a teaching tool — in production, you'd train a classifier on triple-barrier labels and use that as a downstream model. de Prado's book *Advances in Financial ML* is the canonical reference.",
      },
    ],
    related: ["ai-direction", "ai-magnitude", "ai-quantile"],
  },

  "ai-bs-surrogate": {
    intro:
      "A small neural network trained to mimic the analytical Black-Scholes formula. Output is price + all 5 Greeks in a single forward pass — millisecond latency, ~0.1% relative error. Useful when you need to batch-price thousands of options without paying for the closed-form solver every time.",
    shines: [
      "Batch pricing. The NN is vectorised — passing 10,000 options at once is barely slower than passing one.",
      "Inputs inside the training distribution: spot/strike between 0.5× and 2× of each other, IV between 5% and 200%, T from 1 day to 2 years.",
      "When you also need Greeks. Analytical BS needs separate calls per Greek; the NN returns all 6 outputs at once.",
    ],
    fails: [
      "Deep ITM / OTM extremes. The training distribution thinned out past spot/strike ratios of 0.4 or 2.5; predictions degrade.",
      "Extreme IV (>250%). Crypto-like vol regimes weren't well represented.",
      "Anything that isn't European-style. Use the American Pricer or Heston SV bot instead.",
    ],
    verdict:
      "Always HOLD — pricing bots don't trade, they price. The interesting comparison is surrogate price vs the live chain bid/ask. Anything more than 0.5% off is mispriced — that's the trade signal.",
    faq: [
      {
        q: "Why use a neural net when Black-Scholes is closed-form?",
        a: "Two reasons. (1) The same architecture handles the surrogates we don't have closed forms for — Heston, SABR, full Monte Carlo with jumps. Training pipelines are reusable. (2) Once compiled to ONNX, the NN runs ~3-5× faster than scipy.stats.norm.cdf-based analytical Greeks on batched workloads.",
      },
      {
        q: "Why doesn't it match the textbook formula exactly?",
        a: "It's a neural approximation. Mean error is ~0.1% relative; tail error can hit 0.5% at the edges of training distribution. For 99% of use cases that's well below the bid-ask spread.",
      },
    ],
    related: ["ai-iv-solver", "ai-mc-surrogate", "ai-american", "ai-heston", "bs-solver"],
  },

  "ai-iv-solver": {
    intro:
      "Reverse the BS pricer. You have an option's market price and need to back out the implied volatility — what σ makes the formula spit out that price? Classically done with Newton-Raphson, which is fragile near zero vega and can take 20+ iterations. The NN does it in a single forward pass with ~0.9% relative error.",
    shines: [
      "Real-time IV updates as the chain ticks. Newton's method has variable latency depending on starting point; the NN is constant-time.",
      "Building IV surfaces. Need to solve for σ across hundreds of strikes/expiries simultaneously — batch inference shines here.",
      "Robustness near low vega. Newton blows up when ∂Price/∂σ is small; the NN gracefully degrades instead.",
    ],
    fails: [
      "Out-of-distribution. The training set covered 5-200% vol; if the option price implies σ outside that, predictions degrade.",
      "Pricing arbitrage edge cases. When the market price violates put-call parity, no σ exists — the NN just returns its best guess instead of erroring.",
      "Deep ITM/OTM at near-zero time-to-expiry. Both Newton and the NN struggle; you need a different algorithm entirely.",
    ],
    verdict:
      "HOLD always — solver, not a trade signal. The IV it returns is the trade input. Use it as the σ input to the Wheel bot, the BS Solver, or your own pricing logic.",
    faq: [
      {
        q: "Why is the answer slightly different from a Newton-Raphson run?",
        a: "Newton finds the exact σ to floating-point precision. The NN is an approximation with ~0.9% mean relative error. For most use cases this is well inside bid-ask noise; for arbitrage strategies you'd still want the exact solver.",
      },
      {
        q: "Can I trust this when the option is far OTM?",
        a: "Below an option price of ~0.05 the function gets flat and any solver becomes unstable. The NN is no exception — its predictions become noisy at deep OTM.",
      },
    ],
    related: ["ai-bs-surrogate", "bs-solver", "iv-crush"],
  },

  "ai-mc-surrogate": {
    intro:
      "We simulated 100,000 random stock-price paths and averaged the option's payout. Then we trained a neural network on those answers — so now you get the same result without rerunning a million coin flips every time. Distilled Monte Carlo, in a single forward pass.",
    shines: [
      "Sanity-checking BS pricing. If your MC surrogate and your BS price disagree by more than 0.1%, your GBM assumption is broken.",
      "Path-dependent extensions. The same architecture handles Asian options, barrier options, and exotic payoffs by retraining on different ground truths.",
      "Education. Shows students how a network can absorb a stochastic process into a deterministic function.",
    ],
    fails: [
      "Path-dependent options without retraining. The current model was trained on Europeans; barrier/Asian/Bermudan need their own surrogates.",
      "Extreme drift or vol parameters outside training range.",
      "Anything where the variance reduction tricks of real MC matter (control variates, antithetic variates) — the surrogate just learned the average.",
    ],
    verdict:
      "HOLD always. The interesting metric is 'Δ vs BS' — when MC and BS agree to 3 decimal places, the GBM assumption is intact. When they diverge, something's off.",
    faq: [
      {
        q: "Why train a NN on MC when MC is itself an approximation?",
        a: "MC with 100k paths converges to the true expectation under the assumed dynamics. The NN replicates that converged value at 1000× the speed. So you trade 'fresh randomness every call' for 'speed' — which is the right trade for inference.",
      },
      {
        q: "How is this different from BS surrogate?",
        a: "Same outputs for European options under GBM. The MC surrogate is the path you'd extend for non-Europeans (barriers, Asians) — its training pipeline is more general.",
      },
    ],
    related: ["ai-bs-surrogate", "ai-american", "ai-heston"],
  },

  "ai-american": {
    intro:
      "American options can be exercised any time before expiry. That extra freedom is worth a tiny bit more than a European-style option (which can only be cashed at expiry). The bot priced a 500-step Cox-Ross-Rubinstein binomial tree as ground truth, then distilled the answer into a neural network. ~0.5% relative error.",
    shines: [
      "Single-name US equity options. Most of the listed market is American-style; this is the right pricer.",
      "Dividend-paying stocks. Early-exercise premium grows with dividends; the model learns that relationship.",
      "Comparing chain quotes against fair value. Like the BS surrogate, but accurate for American-style.",
    ],
    fails: [
      "Index options (SPX, NDX). Those are European-style; use BS Surrogate instead.",
      "Bermudan and other exotic exercise schedules. The model learned American-style only.",
      "Extreme rates or dividends outside training distribution.",
    ],
    verdict:
      "HOLD always. The published premium (American − European) tells you whether early exercise is worth anything for these specific inputs. If premium > 5% of European price, the early-exercise feature is materially valuable.",
    faq: [
      {
        q: "When should I exercise American puts early?",
        a: "Roughly: when the option is deep ITM and the interest you'd earn on the strike (if exercised and parked in cash) exceeds the time value remaining. The bot doesn't tell you when to exercise — just what the option is worth to someone who has the right.",
      },
      {
        q: "Why no early-exercise boundary in the output?",
        a: "Because we distilled the price, not the policy. The CRR tree implicitly contains the optimal exercise boundary; we trained the NN to mimic the resulting price. If you need the boundary itself, you'd train a separate model on it.",
      },
    ],
    related: ["ai-bs-surrogate", "ai-mc-surrogate", "ai-heston", "bs-solver"],
  },

  "ai-heston": {
    intro:
      "Real markets don't have a single fixed volatility — vol moves around too. Heston is the gold-standard model that simulates that, including the negative correlation that makes puts more expensive than calls (the famous skew). The bot trained on fypy library ground truth, neural-net distilled.",
    shines: [
      "Modelling skew. BS assumes flat IV across strikes; reality has a smile and a smirk. Heston captures it.",
      "Long-dated options where stochastic vol matters most.",
      "Calibrating to a vol surface. Run Heston across the chain, fit (κ, θ, ξ, ρ, v₀) to observed prices.",
    ],
    fails: [
      "Inputs outside training distribution. Heston's parameter space is wide; the surrogate only saw a slice.",
      "Short-dated, near-the-money options. BS is essentially correct there; Heston's edge is at the extremes.",
      "Calibration is hard. The bot prices Heston given parameters — it doesn't fit parameters to a market chain. That's a separate optimisation.",
    ],
    verdict:
      "HOLD always. The 'skew premium' (Heston − BS) is the interesting output. Negative ρ + put = bigger Heston premium = real market behaviour. Tells you how much skew is worth in dollar terms for these inputs.",
    faq: [
      {
        q: "What do κ, θ, ξ, ρ, v₀ mean?",
        a: "v₀: current variance. θ: long-run variance the system reverts to. κ: speed of reversion. ξ: vol of vol (how jumpy the variance itself is). ρ: correlation between stock and variance — typically negative because stocks and vol move opposite.",
      },
      {
        q: "How do I calibrate Heston for a specific stock?",
        a: "Outside the bot's scope. Standard practice: take observed option prices across strikes/expiries, run a least-squares fit on the 5 Heston parameters, plug calibrated params back into the bot for any new strike/expiry. We don't ship the calibration step yet.",
      },
    ],
    related: ["ai-bs-surrogate", "ai-mc-surrogate", "iv-crush", "bs-solver"],
  },

  // ─────────────── TREND ───────────────

  "sma-cross": {
    intro:
      "Two simple moving averages — a fast one and a slow one — chasing each other across the chart. When the fast one cuts up through the slow one, the trend just shifted bullish. When it falls below, the trend's rolling over. Old, unromantic, and surprisingly hard to beat in trending markets.",
    shines: [
      "Persistent trends — SPY 2017, NVDA 2023, BTC 2020-21. The crossover catches the early lean and rides it.",
      "Daily and weekly timeframes. SMAs need enough bars to smooth out noise; intraday is too jumpy.",
      "Pair-trading and rotation strategies, where you only need a directional bias, not a price target.",
    ],
    fails: [
      "Choppy ranges. Two SMAs whipsaw each other — every fake breakout becomes a fresh signal. Win rate craters below 40%.",
      "Earnings gaps. SMAs lag by definition; the cross usually fires after the move is done.",
      "Mean-reverting assets like utilities or crude oil futures during contango. Catch a few false trends, lose a lot.",
    ],
    verdict:
      "BUY when fast SMA > slow SMA (and was below previously). SELL when the reverse. Confidence is proportional to the gap between the two — wider gap means stronger trend. HOLD never fires for SMA Crossover; it's a binary regime signal.",
    faq: [
      {
        q: "What's the best fast/slow combo?",
        a: "There isn't one. 12/26 is the MACD default. 50/200 is the textbook 'golden cross' for daily charts. 9/21 is intraday. Lazybull's defaults (12/26) work fine; tune to fit your asset.",
      },
      {
        q: "Should I trust the backtest win rate?",
        a: "Half-trust it. The backtest assumes you exit on the opposite cross, which means you ride drawdowns to zero before the system flips. In practice you'd add a stop. Use the win rate as a shape indicator — high (60%+) means the bot likes the asset; low (under 45%) means try a reversion bot.",
      },
    ],
    related: ["macd", "donchian", "boll", "kalman"],
  },

  "rsi-rev": {
    intro:
      "RSI is a 0-to-100 thermometer that asks: how stretched is recent buying versus selling? Below 30 = panic-selling overshot. Above 70 = euphoria overshot. The bot fires BUY when RSI exits the oversold zone (recovery starts) and SELL when it exits overbought (cooling).",
    shines: [
      "Range-bound stocks and ETFs (REITs, utilities, sector rotators). RSI extremes mark the band edges.",
      "Single-name large caps that mean-revert intraday after a news pop.",
      "Combined with a trend filter — only take BUYs when the longer-term trend is up. Cuts whipsaws in half.",
    ],
    fails: [
      "Strong trends. RSI can sit above 70 for weeks during a parabolic move; the bot keeps firing SELLs that lose every time.",
      "Earnings-driven gaps. RSI smooths over them, missing the real signal.",
      "Crypto. The 14-period RSI is too slow for the volatility; bumping it to 6 helps but defeats the textbook calibration.",
    ],
    verdict:
      "BUY when RSI just exited the oversold band (was < 30, now ≥ 30). SELL when it just exited overbought (was > 70, now ≤ 70). Confidence is the distance from 50 — the further into the extreme zone before the cross, the more conviction.",
    faq: [
      {
        q: "Should I use 30/70 or 20/80?",
        a: "30/70 fires more often with lower precision. 20/80 fires rarely with much higher precision per fire. For trending markets, 20/80 is safer; for choppy markets, 30/70 catches more reversions. Backtest both on your asset.",
      },
      {
        q: "Why does the bot say BUY when the price is still falling?",
        a: "RSI moves on relative strength of UP days vs DOWN days, not on absolute price. Sometimes price keeps drifting down while the down-momentum slows — that's RSI exiting oversold. The bot is calling the bottom of the move, not the bottom of the bar.",
      },
    ],
    related: ["zscore", "boll", "macd", "kalman"],
  },

  "macd": {
    intro:
      "MACD looks at the difference between two EMA-based trend-followers. When that difference flips from negative to positive, momentum just woke up. When it flips negative, it's running out of steam. The histogram is the difference between the MACD line and its own signal line — that's where the actual cross signals come from.",
    shines: [
      "Pulse-checking momentum. Histogram crossing zero = momentum just turned, regardless of trend direction.",
      "Catching divergences. Price making higher highs while MACD makes lower highs is one of the strongest reversal signals in technical analysis.",
      "Daily and 4h timeframes on liquid names. The default 12/26/9 was tuned for daily.",
    ],
    fails: [
      "Choppy ranges. Histogram crosses zero every other bar; whipsaws kill returns.",
      "Slow-drifting markets. MACD can sit near zero for weeks waiting for momentum.",
      "Short-window instruments (intraday small caps). Default periods are too slow.",
    ],
    verdict:
      "BUY when histogram crosses above zero. SELL when below. Confidence scales with the magnitude of the histogram. Above-zero histogram with rising MACD line is the strongest BUY shape; mirror for SELL.",
    faq: [
      {
        q: "Why not just use the line/signal cross?",
        a: "Histogram crossing zero is mathematically identical to line crossing signal — they're the same event. Using the histogram view makes momentum strength visible at a glance.",
      },
      {
        q: "12/26/9 — should I tune these?",
        a: "Yes for non-daily timeframes. Hourly: 12/26/9 is too slow, try 6/13/4. Weekly: try 5/13/5. Default 12/26/9 was Gerald Appel's choice for daily stocks; it's still close to optimal there.",
      },
    ],
    related: ["sma-cross", "rsi-rev", "boll", "donchian"],
  },

  "donchian": {
    intro:
      "Drew lines through the highest high and lowest low of the last N days. Price punching above the top line = the herd just turned bullish. Below the bottom = bearish breakdown. The Turtle Traders made fortunes on this exact rule in the 1980s. Still works wherever trends persist.",
    shines: [
      "Commodity futures. The original Turtle setup — trend-following on uncorrelated futures — still produces real risk-adjusted returns.",
      "Crypto. BTC's history is a series of 20-day breakouts that turn into 6-month moves.",
      "Position-trading timeframes (weeks to months). The 20-day default is the textbook Turtle window.",
    ],
    fails: [
      "Range-bound markets. Channel breaks are false signals; the price punches above and immediately rolls back.",
      "Single-name stocks during earnings season. Gaps create artificial breakouts.",
      "Short windows. A 5-day Donchian on minute data fires constantly and means nothing.",
    ],
    verdict:
      "BUY when close > upper channel of the prior bar. SELL when close < lower channel. The 'position' metric (where the price sits in the channel) tells you how late you are to the breakout — 100% means at the top, 0% at the bottom. Confidence is |position - 0.5| × 2.",
    faq: [
      {
        q: "What lookback should I use?",
        a: "20 is the System 1 Turtle setting. 55 is System 2 — slower, fewer false breaks, larger profits per trade. For crypto try 14-21; for futures 20-55; for stocks 20 is fine but consider pairing with a 20-day exit on the opposite channel for a clean two-line system.",
      },
      {
        q: "Doesn't this cause look-ahead bias?",
        a: "The bot uses the prior bar's channel to avoid that. So the breakout is computed against yesterday's channel, fired today. That's the textbook implementation.",
      },
    ],
    related: ["sma-cross", "boll", "linreg", "macd"],
  },

  "boll": {
    intro:
      "Two rubber bands stretched k standard deviations away from the average. When price stretches one and snaps back, that's the trade. Wider bands mean the market is jittery; narrow bands mean it's coiling. Bollinger himself wrote that the bands aren't trade signals — they're a regime indicator. Most traders ignore him and use them as signals anyway.",
    shines: [
      "Range-bound markets. Touches at the bands are reversion entries.",
      "Volatility expansion plays. Bollinger 'squeezes' (very narrow bands) often precede big moves.",
      "Combined with RSI for confirmation. Lower-band touch + oversold RSI = stronger reversal signal.",
    ],
    fails: [
      "Strong trends. Price 'walks the band' for weeks during a parabolic move; every touch is a losing fade.",
      "Tight-band false signals. Ranges look like coils until they don't.",
      "Default 20/2 settings. The 2-σ assumption breaks for skewed return distributions.",
    ],
    verdict:
      "BUY when price reclaims the lower band from below. SELL when it rejects the upper band from above. Confidence is the distance from the mid-line, scaled by half-band width. Width of the bands (as % of mid) is a separate volatility regime indicator.",
    faq: [
      {
        q: "Why 20 periods, 2 standard deviations?",
        a: "Bollinger's original choice. 20-period SMA captures roughly a month of daily bars; 2σ catches ~95% of returns under normality (which doesn't perfectly hold, but close enough). Tune with backtest on your asset.",
      },
      {
        q: "What's a Bollinger squeeze?",
        a: "When band width narrows below historical average. Empirically, periods of low volatility tend to be followed by periods of high volatility — squeezes often precede breakouts. Bollinger called it 'the squeeze' in his 2001 book.",
      },
    ],
    related: ["rsi-rev", "zscore", "linreg", "donchian"],
  },

  // ─────────────── STATISTICAL ───────────────

  "zscore": {
    intro:
      "Z-score asks: how unusual is today's price compared to recent days? A z of -2 means 'cheaper than ~97% of recent prices'. A z of +2.5 means 'more expensive than 99% of recent prices'. Most things drift back to average — that's the trade. Pure stat-arb logic.",
    shines: [
      "Pair trading. Compute z-score of (asset A − asset B) and trade reversion to the mean spread.",
      "Mean-reverting equities. Utilities, consumer staples, fixed-income proxies tend to revert.",
      "Short timeframes. Z over 30 bars is a 6-week reversion clock for daily data — fast enough to act on.",
    ],
    fails: [
      "Trending markets. Z-score keeps reading 'unusual' as the trend continues; the bot fades the move and loses.",
      "Short windows. Z over 5-10 bars is essentially noise — the std-dev estimate is too unstable.",
      "Regime breaks. The mean and σ used for z-score are rolling estimates; in a regime shift they lag reality.",
    ],
    verdict:
      "BUY when z just exited the lower threshold (was < -2, now ≥ -2). SELL when it exited the upper. Confidence is |z| / 3 capped at 1.0 — so z = -3 gives full conviction BUY.",
    faq: [
      {
        q: "Why ±2 thresholds and not ±1?",
        a: "Trade-off between fire-rate and precision. ±1 fires too often (every 16% of bars under normality). ±2 fires ~5% of bars and has higher precision per fire. Use ±2.5 if you want only the strongest reversion setups.",
      },
      {
        q: "Z-score of price vs z-score of returns — which?",
        a: "We use price-z because the bot's purpose is reversion. Return-z is appropriate for measuring move sizes (how unusual is today's return?), which is a different question.",
      },
    ],
    related: ["rsi-rev", "boll", "kalman", "linreg"],
  },

  "hurst": {
    intro:
      "Hurst is one number that tells you what kind of market you're in. >0.5 = the trend keeps going (use trend bots). <0.5 = price keeps snapping back (use reversion bots). =0.5 = random, no edge. Computed via R/S analysis over a rolling window. The single most useful regime classifier we have.",
    shines: [
      "Bot selection. Don't run an SMA Crossover when Hurst is 0.4 — you'll get killed. Run a Z-Score bot instead.",
      "Sizing. When Hurst > 0.6, trend bots earn their keep — size up. When 0.45-0.55, scale down.",
      "Asset comparison. Lay Hurst against multiple symbols and rank by trendiness.",
    ],
    fails: [
      "Short windows. R/S analysis needs lots of data — 128 bars is the floor. Below that, Hurst estimates have huge variance.",
      "Regime transitions. Hurst is a slow indicator; by the time it confirms a regime, you've missed half the move.",
      "Microstructure noise. On minute data, Hurst converges to ~0.5 because of bid-ask bouncing.",
    ],
    verdict:
      "Always HOLD — Hurst doesn't trade, it classifies. The 'regime' chip (TREND / RANDOM / REVERT) is what you act on. Use it to gate which other bots you trust on this asset.",
    faq: [
      {
        q: "What's R/S analysis?",
        a: "Rescaled Range. For windows of size n inside the data, compute the range divided by std. Plot log(R/S) against log(n) — the slope is the Hurst exponent. It's a measure of self-similarity in the time series.",
      },
      {
        q: "Why does Hurst sometimes give crazy values like 0.8?",
        a: "Either real strong trend (BTC 2020), or short window producing unstable estimates, or strong autocorrelation that breaks the R/S assumption. Always cross-check with at least 256 bars before trusting an extreme reading.",
      },
    ],
    related: ["sma-cross", "zscore", "kalman", "linreg"],
  },

  "kalman": {
    intro:
      "A Kalman filter is what guides your phone's GPS — it blends what it expects with what it sees. Here it tracks the 'true' price hiding under the noise. The filter adapts: when noise is high, it leans on its expectation; when measurement is clean, it follows the data. Big deviations from filtered fair value are the trade.",
    shines: [
      "Adaptive smoothing. SMAs and EMAs use fixed windows; Kalman re-weights based on observed noise. More robust in changing volatility.",
      "Pair trading spreads. Kalman estimates the slowly-drifting hedge ratio between two assets.",
      "Real-time fair-value tracking. Lower latency than equivalent-quality smoothing methods.",
    ],
    fails: [
      "Misspecified noise parameters. If process noise (Q) and observation noise (R) are off, the filter chases the wrong target.",
      "Non-Gaussian shocks. The filter assumes Gaussian noise; fat-tailed shocks blow it up briefly.",
      "Highly trending markets. Kalman tracks the trend, so 'deviation from fair value' mostly fluctuates around zero — no signal.",
    ],
    verdict:
      "BUY when price just rebounded from > 2% below filtered fair value. SELL when it rejected from > 2% above. Confidence scales with the absolute deviation. The 'fair value' overlay on the chart shows where the filter thinks the true price is right now.",
    faq: [
      {
        q: "What are Q and R?",
        a: "Q (process noise): how much the underlying 'true' price can drift each step. Higher Q = more responsive filter. R (observation noise): how noisy the observed price is. Higher R = filter trusts itself more than the data. Tuning these is most of the art of Kalman filtering.",
      },
      {
        q: "Why use this instead of an EMA?",
        a: "EMA has a fixed smoothing factor; Kalman's smoothing adapts to observed noise. In practice, on liquid stocks, the difference is marginal. On noisier instruments (illiquid bonds, FX crosses), Kalman shines.",
      },
    ],
    related: ["sma-cross", "linreg", "zscore", "boll"],
  },

  "linreg": {
    intro:
      "Draws the best-fit line through recent prices, then puts dotted lines a few standard deviations above and below. Touching the top is overextended; the bottom is washed out. The trend slope of the line itself is its own signal — positive slope = uptrend, negative = down.",
    shines: [
      "Visualising trend strength. Slope and channel width together summarise the regime.",
      "Setting stops. Lower channel for long stops, upper channel for short stops.",
      "Combining with momentum. Trade reversions inside the channel; trend-follow when price pierces the band.",
    ],
    fails: [
      "Sharp regime changes. The regression refits; the channel snaps to the new trend, briefly leaving recent price action outside the band.",
      "Curved trends (parabolic moves). Linear fits a curved trajectory poorly.",
      "Window too short. <30 bars gives unstable slope estimates.",
    ],
    verdict:
      "BUY when price reclaims the lower band from below. SELL when it rejects the upper band. Confidence scales with distance from the mid-line. Slope of the regression line is published in the metrics — sustained positive slope means the trend bot interpretation is the safer one.",
    faq: [
      {
        q: "How is this different from Bollinger?",
        a: "Bollinger's mid-line is an SMA — slope-agnostic. LinReg's mid-line is a least-squares fit — it explicitly captures slope. In trending markets they diverge sharply; in ranges they look similar.",
      },
      {
        q: "What's the right window?",
        a: "Match the window to your trade horizon. 60 bars (~3 months daily) for swing trades. 252 bars for position trades. Shorter windows over-fit recent noise.",
      },
    ],
    related: ["boll", "kalman", "donchian", "sma-cross"],
  },

  // ─────────────── RISK & SIZING ───────────────

  "kelly": {
    intro:
      "Kelly tells you how much of your bankroll to risk per trade so it grows fastest without ever hitting zero. The math is rigorous: f* = (p·b − q) / b, where p is your win probability, q is loss probability, b is win/loss ratio. Half-Kelly (0.5×) gives 75% of the growth with way less stomach-turn — that's what most pros actually use.",
    shines: [
      "Long-horizon compounding. Kelly's optimality is asymptotic — over many trades, full Kelly maximises geometric growth.",
      "Sizing high-conviction setups. When the AI Consensus says ULTRA, plug those probabilities into Kelly for sizing.",
      "Sanity checking gut sizing. Most retail traders over-size; Kelly's number tells you what's actually optimal vs what feels right.",
    ],
    fails: [
      "Probability mis-estimation. Kelly is wildly sensitive to the win-probability input — overstating p by 10% can double your recommended size.",
      "Non-stationary edges. The classic Kelly formula assumes stable p and b; real edges decay.",
      "Drawdown-averse traders. Full Kelly accepts ~50% drawdowns as optimal. Most humans don't.",
    ],
    verdict:
      "BUY when f* > 0 (positive edge exists). WARN when f* ≤ 0 (no edge — don't bet). Confidence scales with the magnitude of the edge. The bet-size dollar value is computed against your declared bankroll. Real practitioners use ¼ to ½ Kelly to dampen the drawdowns.",
    faq: [
      {
        q: "Why not use full Kelly?",
        a: "Full Kelly assumes you know p and b exactly. You don't — you estimate them. If your estimate is off by 20%, full Kelly can lead to ruin. Half-Kelly retains 75% of growth with much smaller drawdowns; quarter-Kelly retains ~50% growth and is what most institutional traders actually use.",
      },
      {
        q: "What's a realistic win probability for a daily trader?",
        a: "55-58% on a directional setup is good. 65%+ is professional-grade or you're miscalibrated. The bot defaults to 55% precisely because that's a realistic baseline.",
      },
    ],
    related: ["mc-var", "sharpe", "ai-consensus"],
  },

  "mc-var": {
    intro:
      "Run thousands of simulated 'next 10 days'. The 5th-worst outcome out of 100 is your Value-at-Risk — the bad day you should plan to survive. CVaR is the average of the days worse than that. The most rigorous way to translate 'how risky is this position' into a dollar number.",
    shines: [
      "Risk budgeting at the portfolio level. Aggregate VaR across positions for a single 95% number.",
      "Margin sizing. Brokers margin you on rough VaR; computing your own gives you an early warning.",
      "Sanity-check stop-losses. If your stop is tighter than 95% VaR, expect to be stopped out frequently by random drift.",
    ],
    fails: [
      "Tail-risk underestimation. MC under GBM (which we use) misses fat-tails — real 99% VaR is worse than this simulation suggests.",
      "Stationarity assumption. The bot uses recent realised vol; in regime shifts (2020 March), VaR was wrong by orders of magnitude before adapting.",
      "Path-dependence. VaR ignores how the loss happened — slow drift to -10% vs gap to -10% have very different psychology.",
    ],
    verdict:
      "Always WARN — VaR doesn't trade, it sizes risk. The headline number is 'plan for losses up to $X this 10-day window'. CVaR is shown alongside as the average of the bad-tail outcomes; that's what you actually lose when VaR breaches.",
    faq: [
      {
        q: "What's the difference between VaR and CVaR?",
        a: "VaR(95%) = the 5th-percentile loss. So 'I will not lose more than this 95% of the time'. CVaR(95%) = the average loss across the worst 5% of cases. CVaR is always worse than VaR and is a better risk number for fat-tailed distributions.",
      },
      {
        q: "Why GBM and not jumps?",
        a: "GBM is the textbook starting point and matches BS. Real markets have jumps; modelling them needs Merton jump-diffusion or similar. We could add it as a parameter — for now, treat the GBM VaR as a lower bound on actual risk.",
      },
    ],
    related: ["kelly", "sharpe", "ai-quantile"],
  },

  "sharpe": {
    intro:
      "Sharpe is return divided by how bumpy the ride was. >1 is good. >2 is rare. >3 is suspicious. Sortino is the same idea but only counts the bumps that hurt (downside vol). The classic risk-adjusted-return summary — every fund manager reports it, every retail trader should know what their own Sharpe is.",
    shines: [
      "Comparing strategies on apples-to-apples basis. A 30% return with 60% vol (Sharpe 0.5) is worse than a 15% return with 10% vol (Sharpe 1.5).",
      "Long-horizon evaluation. Sharpe needs ≥30 monthly observations or ≥250 daily to be reliable.",
      "Position sizing across uncorrelated edges. Equal-Sharpe weighting is provably near-optimal for portfolio construction.",
    ],
    fails: [
      "Skewed distributions. Sharpe punishes upside vol; if your strategy has rare big wins, Sharpe undersells it.",
      "Short windows. Sharpe over a 3-month sample has wildly variable estimates.",
      "Comparing across asset classes. Sharpe of a bond strategy vs a crypto strategy isn't directly meaningful.",
    ],
    verdict:
      "BUY when Sharpe > 1 (quality risk-adjusted return). HOLD between 0 and 1 (positive but mediocre). WARN when Sharpe < 0 (negative edge — paying for pain). Sortino > Sharpe means your returns are positively skewed (good); Sortino < Sharpe is rare and concerning.",
    faq: [
      {
        q: "What's a 'good' Sharpe?",
        a: "Long-only equities historically: ~0.4. A skilled discretionary trader: 0.6-1.0. Top quant funds in their flagship strategies: 1.5-2.5 net of costs. Anything above 3 sustained over years is either alpha that won't persist, or fraud.",
      },
      {
        q: "Should I optimise for Sharpe or absolute return?",
        a: "Sharpe — almost always. Higher Sharpe = more leverage you can apply safely = higher absolute return at any given risk. The only exception is when you can't lever (cash account), in which case absolute return and Sharpe align.",
      },
    ],
    related: ["kelly", "mc-var", "ai-quantile"],
  },

  // ─────────────── OPTIONS ───────────────

  "bs-solver": {
    intro:
      "Plug in 5 numbers, get the textbook fair price of an option plus all 5 Greeks. The Greeks are the option's vital signs: how sensitive the price is to spot moves, time, and volatility. The single most important model in finance — every options trader knows what each Greek means by heart.",
    shines: [
      "Sanity-checking live chain quotes. Anything more than 0.5% off the BS price is mispriced (or you've got the wrong IV).",
      "Greeks at a glance. Especially useful for delta-hedging — the bot returns delta directly.",
      "Options education. Drag the IV slider and watch theta and vega change — the dependencies become visceral.",
    ],
    fails: [
      "American-style options where early exercise matters. Use the American Pricer instead.",
      "Stochastic-vol regimes. BS assumes flat vol across strikes; real markets have skew. Use Heston for skew-aware pricing.",
      "Discrete dividends. The bot ignores them; for dividend-paying stocks within the option's life, error grows.",
    ],
    verdict:
      "Always HOLD — pricing bots don't trade. The interesting comparison is fair price vs the live chain bid/ask. Anything more than 0.5% off is mispriced. Premium-as-percent-of-spot is published as a sanity check (typically 1-5% for ATM monthlies).",
    faq: [
      {
        q: "What are the Greeks?",
        a: "Δ Delta: dPrice/dSpot. Sensitivity to underlying moves. Γ Gamma: d²Price/dSpot². How fast delta changes. Θ Theta: dPrice/dt. Time decay. ν Vega: dPrice/dσ. Sensitivity to vol changes. ρ Rho: dPrice/dr. Sensitivity to rate changes. Memorise these.",
      },
      {
        q: "Why doesn't this match my broker's price?",
        a: "Brokers use mid-market or live bid/ask, not BS fair value. They also adjust for dividends, early exercise, vol smile. The bot is the textbook formula — useful as a benchmark, not as a quote.",
      },
    ],
    related: ["ai-bs-surrogate", "ai-american", "ai-heston", "iv-crush"],
  },

  "iv-crush": {
    intro:
      "Before earnings, options get expensive because nobody knows what'll happen. The instant the news drops, that uncertainty (volatility) collapses — and options lose value even if the stock moves your way. This bot tells you exactly how much you stand to lose to vol crush, separate from any directional move.",
    shines: [
      "Earnings setups. Calculate the IV-only loss before deciding whether long premium even makes sense.",
      "Comparing pre- vs post-event vol regimes. Plug in pre-earnings IV and a typical post-earnings IV and see the damage.",
      "Strategy selection. If IV crush is huge, sell premium (iron condor) instead of buying it (long straddle).",
    ],
    fails: [
      "Underestimating directional moves. The bot only models vol; if the stock gaps 8%, the loss/gain from the move dwarfs the crush.",
      "Calls vs puts asymmetry. IV crush is symmetric in vega; directional results aren't.",
      "Skew changes. Real post-event vol surfaces flatten differently for different strikes; the bot uses a single IV.",
    ],
    verdict:
      "Always WARN — this is a risk diagnostic, not a trade signal. The headline 'crush %' tells you the IV-only loss on a long-premium position over the event. If it's >30%, the directional move needs to be commensurately huge to be worth the long-premium bet.",
    faq: [
      {
        q: "Why do options lose value if the stock moves?",
        a: "Two competing forces. Direction (delta + gamma) gains value when the stock moves your way. Vol crush (vega) loses value as IV collapses post-event. Net P&L = directional gain − vol crush. If the move is small, vol crush wins and you lose even on a 'right' direction call.",
      },
      {
        q: "How big is typical IV crush?",
        a: "Big-cap earnings: pre-event IV is typically 60-80%, post-event drops to 25-40%. That's a 35-55% drop in IV. On a long ATM call with vega ≈ 0.20 per 1% of IV, that's a 7-11% drop in option price — before any directional move.",
      },
    ],
    related: ["bs-solver", "ai-iv-solver", "wheel"],
  },

  "wheel": {
    intro:
      "The Wheel is the patient income trade. You sell cash-secured puts on a stock you wouldn't mind owning. If you get assigned, you flip and sell calls against the shares. Premium income drips in either way. Time is your edge — every cycle pulls more theta out of the chain.",
    shines: [
      "Sideways markets on stocks you'd actually own (large caps, dividend payers).",
      "High-IV environments. More premium per cycle.",
      "Tax-advantaged accounts (IRA). The cycle generates short-term gains that get hammered by ordinary income tax in a regular account.",
    ],
    fails: [
      "Strong downtrends on the underlying. You get assigned at progressively worse prices and your basis erodes faster than the call premium replenishes.",
      "Earnings windows. Vol crush after earnings can crater your sold puts even if the stock holds.",
      "Low-IV environments. The premiums get too small to be worth the capital tie-up.",
    ],
    verdict:
      "BUY when annualised return > 0%. WARN when negative or marginal. The 'premiums' metric tells you total income across cycles; 'annualised' is the rate, useful for comparing against alternatives. Win rate isn't applicable — the wheel doesn't have a win/loss event, just a cumulative P&L.",
    faq: [
      {
        q: "What delta should I sell at?",
        a: "Standard wheel: 0.30 delta puts for entry, 0.30 delta calls for exit. Conservative: 0.20 delta puts (less assignment risk, less premium). Aggressive: 0.45 puts (more premium, much more assignment).",
      },
      {
        q: "When does the wheel break?",
        a: "On a sustained 30%+ drawdown in the underlying. You get assigned at progressively lower strikes; the call premium you collect on the way back up doesn't cover the basis erosion. Wheel works best on low-vol, slowly-rising large caps.",
      },
    ],
    related: ["bs-solver", "iv-crush", "kelly"],
  },
};
