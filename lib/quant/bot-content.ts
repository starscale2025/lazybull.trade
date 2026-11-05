// Hand-written specialty / FAQ content layered on top of the auto-derived
// BotDef fields. Every bot has an entry. The per-bot Learn page reads this
// dictionary; if a bot is missing here it falls through to category defaults.
//
// HOW THIS COPY IS WRITTEN, and why it was rewritten in 2026-09.
//
// The bots emit mechanical labels — long, short, warn — and this file used to
// narrate them as advice: it fed model probabilities into a bankroll-sizing
// formula, told the reader that the top agreement grade meant they had found
// something, and named the states in which to stay out. The diligence memo's
// finding is that a regulator reads the feature, not the disclaimer, and copy
// that tells a named reader what to do with money is investment advice
// however the page is labelled.
//
// So every line here now obeys three rules:
//   1. Describe what a rule DID, in impersonal past tense. Never what to do.
//   2. Name the label the card prints; never address the reader as a trader.
//   3. Every accuracy figure carries HYPOTHETICAL_NOTE in the same sentence.
// Sizing, EV and "edge" language is gone; Kelly is described as the piece of
// maths it is, with nobody told to bet it.

import { HYPOTHETICAL_NOTE } from "./types";

export { HYPOTHETICAL_NOTE };

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
    "Six different AI models look at the same stock and each one votes 'up' or 'down' for the next month. If 5 or 6 of them agree, the card calls that very strong agreement. If they're split 3-3, the models disagree and the card says so. What you are watching is six opinions failing or managing to line up — the card shows who voted and how far apart they landed.",
  "ai-direction":
    "An AI brain made of 7 little decision-tree models, each guessing whether the price will go up or down 20 days from now. We average their guesses to get one probability. When the little models all agree (low spread), the card reports very strong agreement. When they disagree, they were effectively guessing: that state showed no measurable predictive lift historically.",
  "ai-magnitude":
    "Direction models guess which way. This one estimates how big. A 0.5% estimate sits inside the noise of a normal month; a 5% estimate sits outside it. The size printed on the card is one model's estimate of a distribution — never a promise about the next month.",
  "ai-quantile":
    "Most predictors give you one number. This one gives three: a low case, a high case, and the middle. When the whole range sat above zero, the model's uncertainty was one-sided; when the range straddled zero, the model was genuinely unsure. The WIDTH of the range is the lesson — it is the model admitting how little it knows.",
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
    "Two moving averages chase each other across the chart. A fast one (recent prices) and a slow one (older prices). When the fast one cut up through the slow one, the rule printed a long marker; when it fell below, a short one. Old, simple, and it held up better than most things in markets that trended.",
  "rsi-rev":
    "RSI is a 0-to-100 thermometer of how one-sided recent trading has been. Below 30 is where panic selling lands; above 70 is where euphoria lands. The rule printed a long marker when RSI left the oversold zone and a short marker when it left overbought. Whether the price then obliged is the backtest's business, not the thermometer's.",
  "macd":
    "MACD asks: is momentum waking up or running out of steam? It looks at the difference between two trend-followers. When that difference flipped from negative to positive, the rule printed a long marker; when it flipped negative, a short one. It is a momentum measurement with two markers hung off it.",
  "donchian":
    "Drew lines through the highest high and lowest low of the last 20 days. When price punched above the top line the rule printed a long marker; below the bottom line, a short one. The Turtle Traders built the most-documented trend experiment in the literature on this rule in the 1980s — which is why it is here to study.",
  "boll":
    "Two rubber bands stretched a few standard deviations away from the average price. When price stretches one and snaps back, that's the trade. Wider bands mean the market is jittery; narrow bands mean a big move is coming.",

  // ─────────────── STATS ───────────────
  "zscore":
    "Z-score asks: how unusual is today's price compared to recent days? A z of -2 means 'cheaper than 97% of recent prices'. The rule assumes prices drift back to average, so it printed a long marker when the price got unusually cheap and a short marker when it got unusually expensive. Whether they drift back is exactly what the backtest is for.",
  "hurst":
    "One number describing what a series has been doing. Above 0.5 = it kept trending. Below 0.5 = it kept snapping back. Around 0.5 = it behaved like a coin, and both the trend and the reversion rules showed no measurable predictive lift historically on stretches like that.",
  "kalman":
    "A Kalman filter is what guides your phone's GPS — it blends what it expects with what it sees. Here it tracks the 'true' price hiding under the noise. When today's price wanders far from that filtered fair value, it tends to come back.",
  "linreg":
    "Draws the best-fit straight line through recent prices, then puts dotted lines a few standard deviations above and below. The rule treated a touch of the top line as overextended and printed a short marker, a touch of the bottom as washed-out and printed a long one.",

  // ─────────────── RISK ───────────────
  "kelly":
    "A formula from information theory. Given a win probability and a win/loss ratio, it returns the single bankroll fraction that maximises the long-run GROWTH RATE of a bet repeated forever. That is all it is: a statement about compounding under assumptions you supply. The bot computes it for the numbers you type in and shows the curve around it — it does not tell anyone what to bet.",
  "mc-var":
    "Run thousands of simulated 'next 10 days' for the stock. The 5th-worst outcome out of 100 is the Value-at-Risk — the size of a bad-but-ordinary run under the simulation's assumptions. It is a way of seeing that a bad day has a size, and that the size is knowable before it arrives.",
  "sharpe":
    "Sharpe is your return divided by how bumpy the ride was. Above 1 is good, above 2 is rare, above 3 is suspicious. Sortino is the same idea but only counts the bumps that hurt (downside vol). The simplest 'is this strategy any good?' number that exists.",

  // ─────────────── OPTIONS ───────────────
  "bs-solver":
    "Plug in 5 numbers (spot, strike, days, IV, rate), get the textbook fair price of an option plus all 5 Greeks. The Greeks are the option's vital signs: how sensitive its price is to the stock moving, time passing, and vol changing. Memorise these — every options trader knows them by heart.",
  "iv-crush":
    "Before earnings, options get expensive because nobody knows what will happen. The instant the news drops, that uncertainty (volatility) collapses — and an option can lose value even when the stock moves the way its holder wanted. This bot isolates the vol-only part of that: what the position loses to the collapse alone, before any price move is counted.",
  "wheel":
    "A textbook cycle: cash-secured puts are sold against a stock, and if they are assigned, calls are sold against the resulting shares. Premium is collected each cycle, and assignment is the risk that pays for it — the cycle is only pleasant while the underlying behaves.",
};

export const BOT_CONTENT: Record<string, BotContent> = {
  // ─────────────── AI QUANTS ───────────────

  "ai-consensus": {
    intro:
      `Six AI models look at the same stock and vote on direction. The card shows their tally, how strongly they agreed, and the one out-of-sample hit-rate band this family of models has ever been measured at (${HYPOTHETICAL_NOTE}). The agreement number is the teaching object here: six models built on the same data disagreeing is the most useful thing a beginner can watch.`,
    shines: [
      "Liquid US large-caps (AAPL, NVDA, AMZN, SPY) where macro context is rich and per-asset training data is plentiful.",
      "Stable volatility regimes — the models were trained on bands, not regime shifts.",
      "Multi-week horizons (20-day default). Same-day or next-day prediction is much noisier.",
      "When ≥5 of 6 models agree. Agreement across differently-built models is a stronger statement about the data than any single model's opinion.",
    ],
    fails: [
      "Regime breaks. COVID-era March 2020, the 2022 rate cycle, post-earnings gaps — the ensemble was fit on smoother periods.",
      "Tickers Yahoo doesn't have rich data for. The Python side needs ≥250 historical bars to build features.",
      "Crypto and FX. The training basket is US equities; out-of-distribution.",
      "Split votes. When 3-3 or 4-2, the consensus number is essentially noise — the bot will say SPLIT and that's the right answer.",
    ],
    verdict:
      `The card leans long or short only when ≥5 models point the same way AND the average expected magnitude clears 4%; otherwise it stays neutral. The agreement label runs very strong agreement → strong → moderate → lean → split, and it describes the models, not your odds. Every tier is described by ONE hit-rate band, ${HYPOTHETICAL_NOTE} — the band does not climb with the tier.`,
    faq: [
      {
        q: "Why does the consensus give the same answer for AAPL and TSLA?",
        a: "If you see Source: Mock on the card, the FastAPI service is offline and you're getting a deterministic seeded fallback that depends only on the synthetic chart. Start uvicorn (cd \"ai quants\" && uvicorn serve:app --port 8000) and refresh — Source flips to Python NN and AAPL/TSLA each get their own real predictions.",
      },
      {
        q: "What's the historical hit rate?",
        a: `Embargoed walk-forward CV on US large caps put this family of models in one band — ${HYPOTHETICAL_NOTE}. It does not climb with agreement: a 6/6 vote is a statement about the models lining up, not a better set of odds, and the published band covers all of them. Split votes showed no measurable predictive lift historically. Live models also drift 2-4 points below any cross-validated figure once the regime moves, which is the honest reason a single band is quoted rather than a ladder.`,
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
      "An ensemble of 7-14 boosted-tree models, each predicting whether the stock closes up or down 20 days from now. The probability is the mean of their votes; the agreement band reflects how far that probability sits from the 0.5 noise floor. Lower ensemble σ means the trees agreed with each other — which is a fact about the trees, not about the stock.",
    shines: [
      "Names with strong macro coupling (SPY, QQQ, AAPL). The features include cross-asset signals — VIX, DXY, 10Y, WTI — that anchor the prediction.",
      "Mid-cycle markets. The models see lots of those in training and generalise well.",
      "When ensemble σ is low (<0.05). That means the trees agreed with each other rather than the average resting on one fluky leaf.",
    ],
    fails: [
      "Earnings windows. The model treats the 20-day horizon as homogeneous, but earnings can flip the sign in a single bar.",
      "Illiquid tickers. Need ≥250 bars; small-caps with thin history under-perform.",
      "Tail events. The labels were clipped at the 99th percentile — the model literally hasn't seen 2020 March.",
    ],
    verdict:
      `The card's label turns long above p_up 0.6 and short below 0.4, and stays neutral between them. The agreement band sorts that probability into split / moderate / strong / very strong agreement, and the same single hit-rate band is published beside every one of them (${HYPOTHETICAL_NOTE}).`,
    faq: [
      {
        q: "What features does it use?",
        a: "Per-asset: returns over 5/10/20/60/252 days, realized vol, RSI, MACD, distance-from-MA, regime flags. Cross-asset: VIX, DXY, 10Y rate, oil. ~40 features in total, fed into a HistGradientBoostingClassifier ensemble.",
      },
      {
        q: "Why ensemble of 7 instead of 1?",
        a: "Variance reduction. A single GBM has noisy decisions near the threshold; the mean of 7 differently-seeded models is much more stable. The σ across the ensemble doubles as an agreement measure — when σ is high, the trees were guessing.",
      },
    ],
    related: ["ai-consensus", "ai-magnitude", "ai-quantile"],
  },

  "ai-magnitude": {
    intro:
      "Direction's quieter sibling. Instead of asking 'up or down?', it estimates the size of the next 20-day move. A 0.5% expected return is inside the noise; a 5% one clears the bot's noise floor and registers as a high-magnitude reading. The sign is the model's lean and the magnitude is the size it estimated — both are outputs of a fitted regression, not statements about what will happen.",
    shines: [
      "Reading a direction call next to a size. A model that leans up on a 0.4% estimate is telling you almost nothing, and this is where that becomes visible.",
      "Comparing two models on the same tape. When Direction Ensemble and this one lean the same way AND magnitude clears 3%, more of the workbench agreed — which is a fact about the models, not a stronger case.",
      "Names whose historical return distribution is well behaved (sector ETFs, large-cap growth). The regression learns dampened magnitudes that match those distributions.",
      `When 'macro features' is on. Adding VIX and 10Y alignment moved the cross-validated hit rate by about 2 points (${HYPOTHETICAL_NOTE}).`,
    ],
    fails: [
      "Turning points. Regression smooths over inflections; magnitude underestimates reversals.",
      "High-vol assets. The MSE objective penalises large errors disproportionately, so the model under-bets on tail moves.",
      "Out-of-distribution names. Like Direction, needs ≥250 bars and US-equity-shaped data.",
    ],
    verdict:
      "The card leans long above +2% expected return, short below -2%, and stays neutral between. The magnitude band sorts |expRet| into <1.5%, 1.5-2.7%, 2.7-4.5%, 4.5-7% and >7%; the agreement figure scales linearly with |expRet| up to a cap at 8%.",
    faq: [
      {
        q: "What's the difference between this and Direction Ensemble?",
        a: "Direction is a binary classifier — its output is P(up). This is a regression — its output is expected return. Different loss functions, different architectures, different bands. Running both is how you see whether two differently-built models even agree.",
      },
      {
        q: "Why does it sometimes contradict Direction?",
        a: "Different objective functions. Classification is forced to commit to a side; regression can output a number near zero. When they disagreed, the magnitude was usually small — the two models were arguing about noise.",
      },
    ],
    related: ["ai-direction", "ai-consensus", "ai-quantile"],
  },

  "ai-quantile": {
    intro:
      "Most predictors give you one number. This bot gives three — the 10th, 50th and 90th percentile of the 20-day return distribution. That is a real interval rather than a point guess. When the whole interval sat above zero the model's uncertainty was one-sided; when it straddled zero the model was openly unsure. The width is the output that matters.",
    shines: [
      "Risk-aware decisions. The width of the interval tells you how confident the model is — narrow CI = confident, wide CI = market is genuinely uncertain.",
      "Liquid names where the underlying return distribution is well-behaved (ETFs, large-caps).",
      "Seeing what a model does NOT know. p10 and p90 are the two numbers a point forecast throws away, and they are usually further apart than anyone expects.",
      "Periods of expanding volatility. Quantile regression handles heteroskedastic returns better than a point estimate.",
    ],
    fails: [
      "Highly skewed return distributions. The pinball loss assumes the conditional CDF is well-defined; broken at the extremes.",
      "Small datasets. Each quantile has its own model; need lots of data to estimate p10 and p90 reliably.",
      "Tail events. p10 still under-estimates true downside in a 6-sigma move.",
    ],
    verdict:
      "The card leans long only when p10 > 0 — the entire 80% interval sits above zero — and short only when p90 < 0. Otherwise it stays flat. The interval WIDTH is published beside it, and is the most honest uncertainty reading anything in the workbench produces.",
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
      "The card leans long above +1.5% expected return, short below -1.5%, neutral between. The reading scales with |pred|. The 'vol regime' chip is a sanity check: in high-vol regimes the model's estimates shrink, which is the behaviour you want from a model that knows it is out of its depth.",
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
      "The card leans long above +1.5% expected return, short below -1.5%, neutral between. The 'detected pattern' chip (uptrend / downtrend / chop) is a sanity-check label, not a formal classifier output — it is derived from recent trend strength.",
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
      "Reports three probabilities — P(profit target hit), P(stop hit), P(time-out). The most-likely label sorts into +1 (TP), -1 (SL) or 0 (TO). The card leans long when P(profit) > 1.4× P(stop), short when the reverse, neutral otherwise.",
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
      "Always neutral — pricing bots don't trade, they price. The interesting comparison is surrogate price against the chain's bid/ask: a gap wider than 0.5% means the model and the quote disagree, and the useful question is which of the two is wrong.",
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
      "Neutral always — this is a solver, not an opinion. The IV it returns is a model input: the same σ the BS Solver, the Wheel bot and any pricing code of your own take.",
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
      "The card leans long when the fast SMA crosses above the slow one, and short on the reverse cross. The reading is proportional to the gap between the two — a wider gap meant a stronger trend. There is no neutral state: this is a two-state regime rule by construction.",
    faq: [
      {
        q: "What's the best fast/slow combo?",
        a: "There isn't one. 12/26 is the MACD default. 50/200 is the textbook 'golden cross' for daily charts. 9/21 is intraday. lazybull ships 12/26; the backtest is there so you can see for yourself what changing it does.",
      },
      {
        q: "How much does the backtest win rate actually say?",
        a: "Less than it looks. The backtest exits only on the opposite cross, so every drawdown is ridden to the flip — a real system would carry a stop, and that one change moves the number a long way. Read it as a shape: above 60% the rule fitted that asset's history, under 45% it did not, and neither is a statement about next month.",
      },
    ],
    related: ["macd", "donchian", "boll", "kalman"],
  },

  "rsi-rev": {
    intro:
      "RSI is a 0-to-100 thermometer that asks: how stretched is recent buying versus selling? Below 30 is where panic selling lands; above 70, euphoria. The rule printed a long marker when RSI left the oversold zone and a short marker when it left overbought — it marks the thermometer's crossings, nothing more.",
    shines: [
      "Range-bound stocks and ETFs (REITs, utilities, sector rotators). RSI extremes mark the band edges.",
      "Single-name large caps that mean-revert intraday after a news pop.",
      "Read next to a trend filter. Historically, the long markers that landed against a rising longer-term trend whipsawed roughly half as often as the rest.",
    ],
    fails: [
      "Strong trends. RSI can sit above 70 for weeks during a parabolic move; the bot keeps firing SELLs that lose every time.",
      "Earnings-driven gaps. RSI smooths over them, missing the real signal.",
      "Crypto. The 14-period RSI is too slow for the volatility; bumping it to 6 helps but defeats the textbook calibration.",
    ],
    verdict:
      "The card leans long when RSI has just left the oversold band (was < 30, now ≥ 30) and short when it has just left overbought (was > 70, now ≤ 70). The reading is the distance from 50 — the deeper the extreme before the crossing, the higher it runs.",
    faq: [
      {
        q: "Should I use 30/70 or 20/80?",
        a: "30/70 marks far more crossings at lower precision each; 20/80 marks few, with higher precision per marking. In trending stretches the wider band produced fewer losing markers; in choppy ones the tighter band caught more reversions. Both are one backtest away.",
      },
      {
        q: "Why does the bot read UP while the price is still falling?",
        a: "RSI moves on the relative strength of UP days versus DOWN days, not on absolute price. Sometimes price keeps drifting down while the down-momentum slows — that is RSI leaving oversold. The marker is about momentum turning, not about the low of the bar.",
      },
    ],
    related: ["zscore", "boll", "macd", "kalman"],
  },

  "macd": {
    intro:
      "MACD looks at the difference between two EMA-based trend-followers. When that difference flips from negative to positive, momentum just woke up. When it flips negative, it's running out of steam. The histogram is the difference between the MACD line and its own signal line — that's where the actual cross signals come from.",
    shines: [
      "Pulse-checking momentum. Histogram crossing zero = momentum just turned, regardless of trend direction.",
      "Catching divergences. Price making higher highs while MACD makes lower highs is the most-cited reversal pattern in technical analysis — and a good place to learn how often a famous pattern simply fails.",
      "Daily and 4h timeframes on liquid names. The default 12/26/9 was tuned for daily.",
    ],
    fails: [
      "Choppy ranges. Histogram crosses zero every other bar; whipsaws kill returns.",
      "Slow-drifting markets. MACD can sit near zero for weeks waiting for momentum.",
      "Short-window instruments (intraday small caps). Default periods are too slow.",
    ],
    verdict:
      "The card leans long when the histogram crosses above zero and short when it crosses below. The reading scales with the histogram's magnitude, and runs highest when an above-zero histogram is paired with a rising MACD line; mirrored on the short side.",
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
      "Commodity futures. The original Turtle experiment — trend-following across uncorrelated futures — is the most thoroughly documented study of this rule there is.",
      "Crypto. BTC's history is a series of 20-day breakouts that turn into 6-month moves.",
      "Position-trading timeframes (weeks to months). The 20-day default is the textbook Turtle window.",
    ],
    fails: [
      "Range-bound markets. Channel breaks are false signals; the price punches above and immediately rolls back.",
      "Single-name stocks during earnings season. Gaps create artificial breakouts.",
      "Short windows. A 5-day Donchian on minute data fires constantly and means nothing.",
    ],
    verdict:
      "The card leans long when the close clears the prior bar's upper channel and short when it breaks the lower one. The 'position' metric says where price sits inside the channel — 100% at the top, 0% at the bottom — which is how far a breakout has already travelled. The reading is |position - 0.5| × 2.",
    faq: [
      {
        q: "What lookback should I use?",
        a: "20 is the System 1 Turtle setting. 55 is System 2 — slower, with fewer false breaks and longer holds. Crypto studies tend to use 14-21, futures 20-55. Pairing the entry channel with a 20-day exit on the opposite channel is the classic two-line construction.",
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
      "Read alongside RSI. Historically, lower-band touches that coincided with an oversold RSI reversed more often than lower-band touches alone.",
    ],
    fails: [
      "Strong trends. Price 'walks the band' for weeks during a parabolic move; every touch is a losing fade.",
      "Tight-band false signals. Ranges look like coils until they don't.",
      "Default 20/2 settings. The 2-σ assumption breaks for skewed return distributions.",
    ],
    verdict:
      "The card leans long when price reclaims the lower band from below and short when it rejects the upper band from above. The reading is the distance from the mid-line scaled by half the band width. Band width as a percentage of the mid-line is a separate volatility-regime reading.",
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
      "The card leans long when z has just left the lower threshold (was < -2, now ≥ -2) and short when it has left the upper one. The reading is |z| / 3, capped at 1.0 — so z = -3 pins it.",
    faq: [
      {
        q: "Why ±2 thresholds and not ±1?",
        a: "A trade-off between how often the rule marks and how precise each marking is. ±1 marks about 16% of bars under normality — far too many. ±2 marks about 5% at higher precision. ±2.5 marks only the deepest stretches, and marks very rarely.",
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
      "Hurst is one number describing what a series has been doing. >0.5 = it kept trending. <0.5 = it kept snapping back. =0.5 = it behaved like a coin, and rules of either family showed no measurable predictive lift historically on stretches like that. Computed via R/S analysis over a rolling window — the most useful regime description in the workbench.",
    shines: [
      "Understanding why a bot failed. A trend rule run over a stretch with Hurst near 0.4 was fighting a series that kept snapping back, and the equity curve shows it.",
      "Historical context. When Hurst sat above 0.6 the series trended and trend-following rules scored better over that sample; between 0.45-0.55 it behaved more randomly and those rules degraded.",
      "Asset comparison. Lay Hurst against multiple symbols and rank by trendiness.",
    ],
    fails: [
      "Short windows. R/S analysis needs lots of data — 128 bars is the floor. Below that, Hurst estimates have huge variance.",
      "Regime transitions. Hurst is a slow indicator; by the time it confirms a regime, you've missed half the move.",
      "Microstructure noise. On minute data, Hurst converges to ~0.5 because of bid-ask bouncing.",
    ],
    verdict:
      "Always neutral — Hurst doesn't trade, it describes. The 'regime' chip (TREND / RANDOM / REVERT) is the whole output: it says what kind of series the window contained, which is the context every other bot's result should be read against.",
    faq: [
      {
        q: "What's R/S analysis?",
        a: "Rescaled Range. For windows of size n inside the data, compute the range divided by std. Plot log(R/S) against log(n) — the slope is the Hurst exponent. It's a measure of self-similarity in the time series.",
      },
      {
        q: "Why does Hurst sometimes give crazy values like 0.8?",
        a: "Either a genuinely strong trend (BTC 2020), or a short window producing unstable estimates, or strong autocorrelation breaking the R/S assumption. Extreme readings on fewer than 256 bars are usually the estimator, not the market.",
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
      "The card leans long when price has just rebounded from more than 2% below the filtered fair value, and short when it has been rejected from more than 2% above. The reading scales with the absolute deviation. The 'fair value' overlay draws where the filter currently places the underlying price.",
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
      "Framing a stop. The channel edges are the levels most systems built on this rule place their stops against.",
      "Reading it next to momentum. Inside the channel the rule describes reversion; once price pierces a band it is describing a trend, and the same line means two different things.",
    ],
    fails: [
      "Sharp regime changes. The regression refits; the channel snaps to the new trend, briefly leaving recent price action outside the band.",
      "Curved trends (parabolic moves). Linear fits a curved trajectory poorly.",
      "Window too short. <30 bars gives unstable slope estimates.",
    ],
    verdict:
      "The card leans long when price reclaims the lower band from below and short when it rejects the upper one. The reading scales with distance from the mid-line. The regression's slope is published in the metrics: a sustained positive slope means the channel is describing a trend rather than a range, and the two read very differently.",
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
      "A result from information theory, and this bot is here to show the maths rather than to size anything. f* = (p·b − q) / b, where p is the win probability, q = 1 − p, and b the win/loss ratio. f* is the constant fraction of a bankroll that maximises the LONG-RUN GROWTH RATE of a bet repeated forever under those exact assumptions. Growth is asymmetric around it: at 2·f* the expected growth rate is zero, so a positive edge staked too heavily still compounds to nothing.",
    shines: [
      "Understanding compounding. Kelly's optimality is asymptotic: it is a statement about the geometric mean over many repetitions, not about any single bet.",
      "Seeing how sensitive the answer is. Move p by a couple of points and watch f* move by a third — the formula's fragility is the lesson, not its output.",
      "Seeing that the curve has a far side. Growth rises to f*, falls after it, and reaches zero at 2·f*. Almost nobody expects the right-hand half.",
    ],
    fails: [
      "Probability mis-estimation. Kelly is wildly sensitive to the win-probability input — overstating p by 10% can double your recommended size.",
      "Non-stationary edges. The classic Kelly formula assumes stable p and b; real edges decay.",
      "Drawdown-averse traders. Full Kelly accepts ~50% drawdowns as optimal. Most humans don't.",
    ],
    verdict:
      "The card reads positive when f* > 0 and warns when f* ≤ 0, which is the formula reporting that the inputs describe a losing bet. The dollar figure is arithmetic on the bankroll you typed in — the formula's output for your numbers, not a recommendation about yours or anyone's money.",
    faq: [
      {
        q: "Why is the full-Kelly fraction rarely used in practice?",
        a: "Because f* assumes p and b are known exactly, and in markets they are estimated. The error is asymmetric: overstating p pushes the stake past f*, where growth falls away, while understating it merely gives up some growth. The literature quantifies it — at half of f* the growth rate is about three-quarters of the maximum, at a quarter of f* roughly half — which is why published practice sits below f* rather than at it.",
      },
      {
        q: "What win probability does the bot assume?",
        a: "55%, and that default is doing deliberate work. Published studies of directional rules cluster in the mid-50s; anything self-reported above 65% is usually a calibration failure rather than a discovery. Type in 65% and watch f* nearly double — which is the fastest demonstration of why the input, not the formula, is the fragile part.",
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
      "Putting a stop in context. A stop set inside the 95% VaR is inside the range ordinary drift covers, and the simulation shows how often that happened.",
    ],
    fails: [
      "Tail-risk underestimation. MC under GBM (which we use) misses fat-tails — real 99% VaR is worse than this simulation suggests.",
      "Stationarity assumption. The bot uses recent realised vol; in regime shifts (2020 March), VaR was wrong by orders of magnitude before adapting.",
      "Path-dependence. VaR ignores how the loss happened — slow drift to -10% vs gap to -10% have very different psychology.",
    ],
    verdict:
      "Always a warning — VaR doesn't trade, it measures. The headline number is the loss the simulation exceeded 5% of the time over a 10-day window. CVaR sits beside it as the average of that bad tail: the size of the losses that happened once VaR was breached.",
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
      "Reading portfolio-construction papers. Equal-Sharpe weighting across uncorrelated return streams is a standard textbook result, and this is the number it is written in.",
    ],
    fails: [
      "Skewed distributions. Sharpe punishes upside vol; if your strategy has rare big wins, Sharpe undersells it.",
      "Short windows. Sharpe over a 3-month sample has wildly variable estimates.",
      "Comparing across asset classes. Sharpe of a bond strategy vs a crypto strategy isn't directly meaningful.",
    ],
    verdict:
      "The card reads positive above a Sharpe of 1, neutral between 0 and 1, and warns below 0 — a negative Sharpe means the sample took volatility and returned less than cash for it. Sortino above Sharpe means the return series was positively skewed; Sortino below Sharpe is rare and worth looking into.",
    faq: [
      {
        q: "What's a 'good' Sharpe?",
        a: "Long-only equities historically: ~0.4. A skilled discretionary trader: 0.6-1.0. Top quant funds in their flagship strategies: 1.5-2.5 net of costs. Anything above 3 sustained over years is either alpha that won't persist, or fraud.",
      },
      {
        q: "Why do professionals quote Sharpe rather than return?",
        a: "Because return alone is not comparable across strategies. Sharpe is return per unit of volatility, so it ranks two strategies on the same axis regardless of how much risk each one ran. In an unlevered cash account the two orderings collapse into one, which is why the distinction is invisible to most beginners.",
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
      "Understanding why a 'right' directional call still lost. When the crush figure is large, it dominates everything the price move contributed.",
    ],
    fails: [
      "Underestimating directional moves. The bot only models vol; if the stock gaps 8%, the loss/gain from the move dwarfs the crush.",
      "Calls vs puts asymmetry. IV crush is symmetric in vega; directional results aren't.",
      "Skew changes. Real post-event vol surfaces flatten differently for different strikes; the bot uses a single IV.",
    ],
    verdict:
      "Always a warning — this is a diagnostic, not a directional call. The headline 'crush %' isolates the IV-only loss a long-premium position takes across the event. Above 30%, the price move has to be very large before it covers the vol collapse alone.",
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
      "A textbook cycle rather than a strategy recommendation: cash-secured puts are sold, assignment converts them into shares, and calls are sold against those shares until they are called away. Premium is collected each cycle and theta is what pays it. The cycle is only pleasant while the underlying behaves, which is the part the premium is compensating for.",
    shines: [
      "Sideways markets on stocks you'd actually own (large caps, dividend payers).",
      "High-IV environments. More premium per cycle.",
      "Seeing where the returns come from. The cycle produces many small short-dated gains, which is a very different return shape from holding the stock.",
    ],
    fails: [
      "Strong downtrends on the underlying. You get assigned at progressively worse prices and your basis erodes faster than the call premium replenishes.",
      "Earnings windows. Vol crush after earnings can crater your sold puts even if the stock holds.",
      "Low-IV environments. The premiums get too small to be worth the capital tie-up.",
    ],
    verdict:
      "The card reads positive when the simulated annualised return is above 0% and warns when it is negative or marginal. The 'premiums' metric is total premium collected across the cycles; 'annualised' is the same figure as a rate. Win rate does not apply — the cycle has no win/loss event, only a running P&L.",
    faq: [
      {
        q: "What deltas do published wheel write-ups use?",
        a: "The conventional description uses 0.30-delta puts for entry and 0.30-delta calls on the way out. Lower deltas (0.20) were assigned less often and collected less; higher ones (0.45) collected more and were assigned far more. Delta is roughly the assignment probability, which is the whole trade-off in one number.",
      },
      {
        q: "When does the wheel break?",
        a: "On a sustained 30%+ drawdown in the underlying. You get assigned at progressively lower strikes; the call premium you collect on the way back up doesn't cover the basis erosion. Wheel works best on low-vol, slowly-rising large caps.",
      },
    ],
    related: ["bs-solver", "iv-crush", "kelly"],
  },
};
