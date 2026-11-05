"""ML track — nine problems."""

from common import Spec, case

TRIPLE_BARRIER = Spec(
    slug="triple-barrier-labels",
    fn="triple_barrier",
    statement=[
        "Implement `triple_barrier(closes, i, up, down, horizon)` — the triple-barrier label for the bar at index `i`. Walk forward through bars `i+1 .. i+horizon` (never past the end of the series): return `1` the first time a close is at or above `closes[i]·(1 + up)`, `-1` the first time a close is at or below `closes[i]·(1 - down)`, and `0` if neither barrier is touched before the horizon runs out.",
        "This is how de Prado labels a bar for a classifier: the profit-taking barrier, the stop-loss barrier and the vertical time barrier. The workbench's triple-barrier model is trained on exactly these labels. If both barriers are touched on the same bar, the stop wins.",
    ],
    constraints=["0 ≤ i < len(closes) ≤ 10_000", "0 < up, down ≤ 1", "1 ≤ horizon ≤ 60"],
    hints=[
        "Compute the two price levels once, before the loop.",
        "The loop has two exits: a barrier touch, or running out of bars. There is a third — the horizon.",
        "Stop the walk at i + horizon. A barrier hit after that is not this label's business; return 0.",
    ],
    ref="""
def triple_barrier(closes, i, up, down, horizon):
    top = closes[i] * (1 + up)
    bottom = closes[i] * (1 - down)
    end = min(i + horizon, len(closes) - 1)
    for j in range(i + 1, end + 1):
        if closes[j] <= bottom:
            return -1
        if closes[j] >= top:
            return 1
    return 0
""",
    stub_py="""
def triple_barrier(closes: list, i: int, up: float, down: float, horizon: int) -> int:
    \"\"\"1 = profit barrier first, -1 = stop first, 0 = neither within the horizon.\"\"\"
    top = closes[i] * (1 + up)
    bottom = closes[i] * (1 - down)
    # TODO: the vertical barrier — stop walking at i + horizon, not at the end of the series
    end = len(closes) - 1
    for j in range(i + 1, end + 1):
        if closes[j] <= bottom:
            return -1
        if closes[j] >= top:
            return 1
    return 0
""",
    stub_ts="""
/** 1 = profit barrier first, -1 = stop first, 0 = neither within the horizon. */
export function tripleBarrier(closes: number[], i: number, up: number, down: number, horizon: number): number {
  const top = closes[i] * (1 + up);
  const bottom = closes[i] * (1 - down);
  // TODO: the vertical barrier — stop walking at i + horizon, not at the end of the series
  const end = closes.length - 1;
  for (let j = i + 1; j <= end; j++) {
    if (closes[j] <= bottom) return -1;
    if (closes[j] >= top) return 1;
  }
  return 0;
}
""",
    cases=[
        case("1", closes=[100.0, 101.0, 103.0, 106.0, 104.0], i=0, up=0.05, down=0.03, horizon=5),
        case("2", closes=[100.0, 99.0, 97.5, 96.0, 98.0, 101.0], i=0, up=0.05, down=0.03, horizon=5),
        case("3", closes=[100.0, 101.0, 102.0, 101.5, 103.0, 106.0], i=0, up=0.05, down=0.03, horizon=3),
        case("h1", closes=[50.0, 50.5, 51.0, 50.8, 50.2, 49.9], i=0, up=0.05, down=0.05, horizon=5),
        case("h2", closes=[200.0, 199.0, 198.0, 197.0, 190.0, 210.0], i=0, up=0.04, down=0.04, horizon=2),
        case("h3", closes=[10.0, 10.4, 10.6, 10.2, 9.5], i=1, up=0.02, down=0.05, horizon=3),
        case("h4", closes=[100.0, 96.0, 95.0, 105.0], i=0, up=0.04, down=0.04, horizon=10),
        case("h5", closes=[80.0, 81.0, 82.0], i=0, up=0.1, down=0.1, horizon=5),
        case("h6", closes=[100.0, 100.0, 104.0, 104.0, 108.0], i=1, up=0.04, down=0.02, horizon=4),
    ],
    examples=["1", "3"],
    example_notes={"3": "The profit barrier is only touched on bar 5 — after the 3-bar horizon."},
    dataset="SPY · 2015-01-02 → 2024-12-31 · 2,516 bars",
    editorial=[
        "Fixed-horizon labels — did the price go up over the next ten bars? — throw away everything that happened in between. Triple-barrier labelling keeps it: a profit-taking barrier above, a stop-loss barrier below, and a vertical barrier in time. The label is whichever barrier the path touches first.",
        "The walk is a loop with a strict order. Compute the two price levels from the entry bar, then step forward one bar at a time. Check the stop before the profit barrier when both are touched on the same bar — the pessimistic reading is the one a live position would have felt. Stop at the horizon; a touch after it belongs to a different label.",
        "The classic mistake is forgetting the vertical barrier and walking to the end of the series. Every label then becomes ±1 eventually, the classifier learns that prices always move, and the backtest looks superb until it meets a market that goes sideways for three weeks.",
        "The workbench's triple-barrier model consumes these labels sized by realised volatility rather than fixed percentages, so a quiet tape and a wild one get barriers that mean the same thing. That scaling is the next problem in the track.",
    ],
)

PURGED_KFOLD = Spec(
    slug="purged-embargo-kfold",
    fn="purged_folds",
    statement=[
        "Implement `purged_folds(n, k, purge, embargo)` — K-fold splits for a time series of `n` observations. Cut the index into `k` contiguous test blocks (the remainder goes to the last block). For each block, the training set is every index NOT in `[test_start - purge, test_end + embargo]`. Return one row per fold: `[test_start, test_end, train_count]` with `test_end` inclusive.",
        "Random K-fold on a time series lets tomorrow leak into today's training set; purging removes the overlap before the test block and the embargo removes the echo after it. The direction models in the `ai quants` folder are evaluated exactly this way.",
    ],
    constraints=["k ≥ 2", "n ≥ 4·k", "0 ≤ purge, embargo ≤ n // k"],
    hints=[
        "The exclusion window is wider than the test block on both sides.",
        "Purging handles the observations just before the test block. The embargo is a separate cut just after it.",
    ],
    ref="""
def purged_folds(n, k, purge, embargo):
    size = n // k
    out = []
    for f in range(k):
        start = f * size
        end = n - 1 if f == k - 1 else start + size - 1
        lo = max(0, start - purge)
        hi = min(n - 1, end + embargo)
        train = n - (hi - lo + 1)
        out.append([start, end, train])
    return out
""",
    stub_py="""
def purged_folds(n: int, k: int, purge: int, embargo: int) -> list:
    \"\"\"[test_start, test_end, train_count] per fold; test_end inclusive.\"\"\"
    size = n // k
    out = []
    for f in range(k):
        start = f * size
        end = n - 1 if f == k - 1 else start + size - 1
        lo = max(0, start - purge)
        # TODO: embargo — drop the `embargo` observations right after the test block too
        hi = end
        train = n - (hi - lo + 1)
        out.append([start, end, train])
    return out
""",
    cases=[
        case("1", n=100, k=5, purge=2, embargo=0),
        case("2", n=60, k=3, purge=0, embargo=0),
        case("3", n=100, k=5, purge=2, embargo=3),
        case("h1", n=50, k=5, purge=1, embargo=0),
        case("h2", n=120, k=4, purge=5, embargo=5),
        case("h3", n=33, k=3, purge=0, embargo=0),
        case("h4", n=200, k=10, purge=3, embargo=0),
        case("h5", n=40, k=4, purge=2, embargo=0),
        case("h6", n=90, k=3, purge=4, embargo=0),
    ],
    examples=["1", "3"],
    dataset="34 tickers · 2010-01-04 → 2024-12-31 · daily",
)

WALK_FORWARD = Spec(
    slug="walk-forward-folds",
    fn="walk_forward",
    statement=[
        "Implement `walk_forward(n, folds, min_train)` — expanding-window validation splits for `n` observations. The first `min_train` observations are always training; the remaining `n - min_train` are cut into `folds` contiguous test blocks of equal size, with the remainder given to the LAST block. Each fold trains on every observation before its test block. Return one row per fold: `[train_start, train_end, test_start, test_end]`, ends inclusive.",
        "One accuracy number is a guess; a distribution across folds is evidence. The `ai quants` walk-forward harness reports exactly this.",
    ],
    constraints=["folds ≥ 1", "n - min_train ≥ folds", "min_train ≥ 1"],
    hints=[
        "Test block size is (n − min_train) // folds; the last block absorbs whatever is left.",
        "If you drop the remainder, the last fold silently ignores the newest rows — the ones you care about most.",
    ],
    ref="""
def walk_forward(n, folds, min_train):
    size = (n - min_train) // folds
    out = []
    for f in range(folds):
        test_start = min_train + f * size
        test_end = n - 1 if f == folds - 1 else test_start + size - 1
        out.append([0, test_start - 1, test_start, test_end])
    return out
""",
    stub_py="""
def walk_forward(n: int, folds: int, min_train: int) -> list:
    \"\"\"[train_start, train_end, test_start, test_end] per expanding fold.\"\"\"
    size = (n - min_train) // folds
    out = []
    for f in range(folds):
        test_start = min_train + f * size
        # TODO: the last fold should run to n - 1 — the remainder rows are being dropped
        test_end = test_start + size - 1
        out.append([0, test_start - 1, test_start, test_end])
    return out
""",
    cases=[
        case("1", n=100, folds=4, min_train=20),
        case("2", n=50, folds=5, min_train=10),
        case("3", n=100, folds=3, min_train=20),
        case("h1", n=30, folds=2, min_train=10),
        case("h2", n=75, folds=4, min_train=25),
        case("h3", n=252, folds=4, min_train=52),
        case("h4", n=40, folds=1, min_train=20),
        case("h5", n=1000, folds=5, min_train=500),
        case("h6", n=64, folds=8, min_train=16),
    ],
    examples=["1", "3"],
    example_notes={"3": "80 test rows into 3 folds leaves 2 over — they belong to the last fold."},
)

FEATURES = Spec(
    slug="feature-matrix",
    fn="features",
    statement=[
        "Implement `features(closes, window)` — the feature row for the LAST bar: `[ret1, momentum, vol]` where `ret1 = closes[-1] / closes[-2] - 1`, `momentum = closes[-1] / closes[-1 - window] - 1` (the return over exactly `window` bars), and `vol` is the population standard deviation of the last `window` one-bar simple returns.",
        "Every model in the `ai quants` folder starts from a table like this — aligned, leak-free, one row per bar. Return the three values rounded to 4 decimal places.",
    ],
    constraints=["window + 1 ≤ len(closes) ≤ 10_000", "every close > 0"],
    hints=[
        "Momentum over `window` bars compares the last close with the close `window` bars earlier — index -1 - window.",
        "Off-by-one look-backs are the most common feature bug; check which bar you are dividing by.",
    ],
    ref="""
from statistics import pstdev

def features(closes, window):
    ret1 = closes[-1] / closes[-2] - 1
    momentum = closes[-1] / closes[-1 - window] - 1
    rets = [closes[i] / closes[i - 1] - 1 for i in range(len(closes) - window, len(closes))]
    return [round(ret1, 4), round(momentum, 4), round(pstdev(rets), 4)]
""",
    stub_py="""
from statistics import pstdev


def features(closes: list, window: int) -> list:
    \"\"\"[ret1, momentum, vol] for the last bar, rounded to 4 dp.\"\"\"
    ret1 = closes[-1] / closes[-2] - 1
    # TODO: momentum looks back one bar short — the reference bar is closes[-1 - window]
    momentum = closes[-1] / closes[-window] - 1
    rets = [closes[i] / closes[i - 1] - 1 for i in range(len(closes) - window, len(closes))]
    return [round(ret1, 4), round(momentum, 4), round(pstdev(rets), 4)]
""",
    cases=[
        case("1", closes=[100.0, 100.0, 100.0, 103.0, 102.0, 104.0], window=4),
        case("2", closes=[50.0, 50.0, 50.0, 51.0, 52.0], window=3),
        case("3", closes=[100.0, 98.0, 101.0, 103.0, 102.0, 104.0], window=4),
        case("h1", closes=[10.0, 10.0, 10.0, 10.2, 10.8], window=3),
        case("h2", closes=[200.0, 205.0, 203.0, 208.0, 210.0, 207.0], window=5),
        case("h3", closes=[75.0, 75.0, 75.0, 74.0], window=2),
        case("h4", closes=[1.0, 1.0, 1.0, 1.0, 1.1, 1.05], window=4),
        case("h5", closes=[300.0, 300.0, 300.0, 305.0, 315.0, 320.0, 318.0], window=5),
        case("h6", closes=[20.0, 20.0, 20.0, 21.0], window=2),
    ],
    examples=["1", "3"],
    dataset="34 tickers · daily OHLCV · 2010 → 2024",
)

CS_RANK = Spec(
    slug="cross-sectional-rank",
    fn="cs_rank",
    statement=[
        "Implement `cs_rank(values)` — the cross-sectional percentile rank of each value among its peers: rank the values ascending from 0 to `n - 1`, give TIED values the average of the ranks they would occupy, then divide by `n - 1` so the result lies in [0, 1].",
        "Ranking forward returns across the 34 names in the basket strips out whatever the whole market did that day — the cross-sectional model in `ai quants` predicts this rank, not the return. Return the ranks rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ len(values) ≤ 500"],
    hints=[
        "Sort a copy, then look each value up. Equal values must get equal ranks.",
        "Two values tied for positions 2 and 3 both get rank 2.5.",
    ],
    ref="""
def cs_rank(values):
    n = len(values)
    order = sorted(values)
    out = []
    for v in values:
        first = order.index(v)
        last = n - 1 - order[::-1].index(v)
        out.append(round((first + last) / 2 / (n - 1), 4))
    return out
""",
    stub_py="""
def cs_rank(values: list) -> list:
    \"\"\"Percentile rank of each value among the others, in [0, 1], 4 dp.\"\"\"
    n = len(values)
    order = sorted(values)
    out = []
    for v in values:
        # TODO: ties should share the average of their ranks — this takes the first position only
        out.append(round(order.index(v) / (n - 1), 4))
    return out
""",
    cases=[
        case("1", values=[0.02, -0.01, 0.05, 0.0]),
        case("2", values=[3.0, 1.0, 2.0, 5.0, 4.0]),
        case("3", values=[0.02, 0.02, 0.05, -0.01]),
        case("h1", values=[-0.03, 0.01, 0.04]),
        case("h2", values=[1.0, 1.0, 1.0, 2.0]),
        case("h3", values=[10.0, 9.0, 8.0, 7.0, 6.0, 5.0]),
        case("h4", values=[0.5, -0.5]),
        case("h5", values=[0.011, 0.012, 0.013, 0.01]),
        case("h6", values=[-2.0, 3.0, 1.0, 0.0, 2.0, -1.0]),
    ],
    examples=["1", "3"],
    example_notes={"3": "Two names tied at 2% share rank 1.5."},
)

QUANTILE_SIGNAL = Spec(
    slug="quantile-signal",
    fn="quantile_signal",
    statement=[
        "Implement `quantile_signal(p10, p50, p90)` — turn a quantile-regression forecast into a position for each asset: `1` (long) when the 10th percentile of the forecast return is above zero, `-1` (short) when the 90th percentile is below zero, else `0` (flat). The three inputs are lists of equal length.",
        "A median forecast alone says nothing about conviction; the interval does. This is the exact rule the workbench's quantile model uses to commit. Return the list of signals.",
    ],
    constraints=["1 ≤ len(p10) == len(p50) == len(p90) ≤ 1_000", "p10 ≤ p50 ≤ p90 elementwise"],
    hints=[
        "Long needs the WHOLE lower tail above zero; short needs the whole upper tail below it.",
        "There are two conviction tests, not one — flat is only for when both fail.",
    ],
    ref="""
def quantile_signal(p10, p50, p90):
    out = []
    for lo, mid, hi in zip(p10, p50, p90):
        if lo > 0:
            out.append(1)
        elif hi < 0:
            out.append(-1)
        else:
            out.append(0)
    return out
""",
    stub_py="""
def quantile_signal(p10: list, p50: list, p90: list) -> list:
    \"\"\"1 long, -1 short, 0 flat — one signal per asset.\"\"\"
    out = []
    for lo, mid, hi in zip(p10, p50, p90):
        if lo > 0:
            out.append(1)
        # TODO: the short side — when the whole upper tail (p90) is below zero
        else:
            out.append(0)
    return out
""",
    cases=[
        case("1", p10=[0.01, -0.02, 0.005], p50=[0.03, 0.0, 0.02], p90=[0.05, 0.02, 0.04]),
        case("2", p10=[-0.01, -0.03], p50=[0.01, 0.0], p90=[0.03, 0.03]),
        case("3", p10=[0.01, -0.06, -0.02], p50=[0.03, -0.03, 0.0], p90=[0.05, -0.01, 0.02]),
        case("h1", p10=[0.002], p50=[0.01], p90=[0.02]),
        case("h2", p10=[-0.05, -0.04], p50=[-0.03, -0.01], p90=[-0.01, 0.02]),
        case("h3", p10=[-0.01, -0.01, -0.01], p50=[0.0, 0.0, 0.0], p90=[0.01, 0.01, 0.01]),
        case("h4", p10=[0.0, 0.001], p50=[0.01, 0.01], p90=[0.02, 0.02]),
        case("h5", p10=[0.03, 0.02, -0.01, 0.005], p50=[0.04, 0.03, 0.01, 0.01], p90=[0.06, 0.05, 0.03, 0.02]),
        case("h6", p10=[-0.02], p50=[0.0], p90=[0.02]),
    ],
    examples=["1", "3"],
)

REGIME = Spec(
    slug="regime-split-vix",
    fn="regime",
    statement=[
        "Implement `regime(vix, window)` — for every day `t >= window`, flag `1` if the VIX close is STRICTLY above the median of the previous `window` closes (`vix[t - window : t]`, excluding today), else `0`. Return the list of flags, one per day from `t = window` onward.",
        "The regime model in `ai quants` routes each day to a high-vol or low-vol specialist on exactly this switch. Use `statistics.median`.",
    ],
    constraints=["window + 1 ≤ len(vix) ≤ 10_000", "1 ≤ window ≤ 120"],
    hints=[
        "The window ends at yesterday — today's value is what you are testing.",
        "Strictly above. A day that exactly equals the median is not a high-vol day.",
    ],
    ref="""
from statistics import median

def regime(vix, window):
    out = []
    for t in range(window, len(vix)):
        m = median(vix[t - window:t])
        out.append(1 if vix[t] > m else 0)
    return out
""",
    stub_py="""
from statistics import median


def regime(vix: list, window: int) -> list:
    \"\"\"1 = high-vol day (above the trailing median), 0 = low-vol.\"\"\"
    out = []
    for t in range(window, len(vix)):
        m = median(vix[t - window:t])
        # TODO: a tie is not a high-vol day — strictly above
        out.append(1 if vix[t] >= m else 0)
    return out
""",
    cases=[
        case("1", vix=[15.0, 16.0, 14.0, 17.0, 13.0, 18.0], window=3),
        case("2", vix=[20.0, 22.0, 21.5, 19.0, 25.0], window=2),
        case("3", vix=[15.0, 16.0, 14.0, 15.0, 13.0, 18.0], window=3),
        case("h1", vix=[12.0, 13.0, 12.7, 14.0], window=2),
        case("h2", vix=[30.0, 28.0, 29.0, 29.0, 27.0], window=3),
        case("h3", vix=[18.0, 18.5, 17.0, 19.5, 16.0, 21.0, 15.0], window=4),
        case("h4", vix=[25.0, 24.0, 26.0], window=1),
        case("h5", vix=[10.0, 11.0, 12.0, 13.0, 14.0], window=2),
        case("h6", vix=[40.0, 35.0, 30.0, 28.0, 26.0], window=3),
    ],
    examples=["1", "3"],
    example_notes={"3": "Day 3 equals its trailing median exactly — that is a 0."},
    dataset="^VIX · 2010-01-04 → 2024-12-31 · daily",
)

STACKING = Spec(
    slug="stacking-oof-features",
    fn="oof_predictions",
    statement=[
        "Implement `oof_predictions(y, k)` — out-of-fold predictions from the simplest level-1 model there is: the mean. Cut the `n` observations into `k` contiguous folds (remainder to the last); for each fold, predict every one of its observations with the mean of `y` over all the OTHER folds. Return the `n` predictions in order.",
        "A stacked meta-learner trains on level-1 predictions; if those predictions saw the answer, the stack is a leak wearing a lab coat. This is the `ai quants` stacking lever with the model reduced to its skeleton. Return values rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ k ≤ n ≤ 5_000"],
    hints=[
        "For each fold, the training set is everything outside it.",
        "Using the full-sample mean gives every observation a peek at its own label.",
    ],
    ref="""
def oof_predictions(y, k):
    n = len(y)
    size = n // k
    out = [0.0] * n
    for f in range(k):
        start = f * size
        end = n if f == k - 1 else start + size
        rest = y[:start] + y[end:]
        m = sum(rest) / len(rest)
        for i in range(start, end):
            out[i] = round(m, 4)
    return out
""",
    stub_py="""
def oof_predictions(y: list, k: int) -> list:
    \"\"\"Out-of-fold mean predictions, one per observation, 4 dp.\"\"\"
    n = len(y)
    size = n // k
    out = [0.0] * n
    for f in range(k):
        start = f * size
        end = n if f == k - 1 else start + size
        # TODO: exclude the held-out fold — this mean includes the rows it is predicting
        m = sum(y) / n
        for i in range(start, end):
            out[i] = round(m, 4)
    return out
""",
    cases=[
        case("1", y=[1.0, 2.0, 1.0, 2.0, 1.0, 2.0], k=3),
        case("2", y=[0.5, 0.5, 0.5, 0.5], k=2),
        case("3", y=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], k=3),
        case("h1", y=[3.0, 1.0, 3.0, 1.0], k=2),
        case("h2", y=[0.01, 0.03, -0.02, 0.04, 0.0, -0.01], k=2),
        case("h3", y=[2.0, 4.0, 2.0, 4.0, 2.0, 4.0, 2.0, 4.0], k=4),
        case("h4", y=[7.0, 7.0, 7.0], k=3),
        case("h5", y=[1.0, 3.0, 1.0, 3.0, 1.0, 3.0], k=3),
        case("h6", y=[10.0, 20.0, 10.0, 20.0], k=2),
    ],
    examples=["1", "3"],
    example_notes={"3": "Fold means differ from the full mean here, so the leak shows."},
)

CALIBRATION = Spec(
    slug="calibrate-probabilities",
    fn="calibration_error",
    statement=[
        "Implement `calibration_error(probs, labels, bins)` — the expected calibration error of a binary classifier. Split [0, 1] into `bins` equal-width bins and assign each probability to bin `min(int(p·bins), bins - 1)` (so `p = 1.0` lands in the last bin). For every non-empty bin add `(count / n)·|mean probability - fraction of positive labels|`.",
        "The consensus model in `ai quants` reports calibrated probabilities because a confident wrong number is worse than an honest vague one. Return the error rounded to 4 decimal places.",
    ],
    constraints=["1 ≤ len(probs) == len(labels) ≤ 10_000", "0 ≤ p ≤ 1", "labels ∈ {0, 1}", "2 ≤ bins ≤ 20"],
    hints=[
        "Weight each bin by how many predictions fell into it.",
        "A probability of exactly 1.0 times `bins` is `bins` — one past the last index. Clamp it.",
    ],
    ref="""
def calibration_error(probs, labels, bins):
    n = len(probs)
    sums = [0.0] * bins
    pos = [0] * bins
    cnt = [0] * bins
    for p, y in zip(probs, labels):
        b = min(int(p * bins), bins - 1)
        sums[b] += p
        pos[b] += y
        cnt[b] += 1
    err = 0.0
    for b in range(bins):
        if cnt[b]:
            err += cnt[b] / n * abs(sums[b] / cnt[b] - pos[b] / cnt[b])
    return round(err, 4)
""",
    stub_py="""
def calibration_error(probs: list, labels: list, bins: int) -> float:
    \"\"\"Expected calibration error over equal-width bins, rounded to 4 dp.\"\"\"
    n = len(probs)
    sums = [0.0] * bins
    pos = [0] * bins
    cnt = [0] * bins
    for p, y in zip(probs, labels):
        # TODO: p == 1.0 maps to index `bins`, one past the end — clamp it
        b = int(p * bins)
        sums[b] += p
        pos[b] += y
        cnt[b] += 1
    err = 0.0
    for b in range(bins):
        if cnt[b]:
            err += cnt[b] / n * abs(sums[b] / cnt[b] - pos[b] / cnt[b])
    return round(err, 4)
""",
    cases=[
        case("1", probs=[0.1, 0.4, 0.35, 0.8, 0.9, 0.6], labels=[0, 0, 1, 1, 1, 0], bins=5),
        case("2", probs=[0.2, 0.7, 0.75, 0.3], labels=[0, 1, 1, 0], bins=2),
        case("3", probs=[0.1, 0.5, 1.0, 0.95, 0.3], labels=[0, 1, 1, 1, 0], bins=5),
        case("h1", probs=[0.05, 0.15, 0.85, 0.95], labels=[0, 0, 1, 1], bins=10),
        case("h2", probs=[0.0, 0.5, 1.0], labels=[0, 0, 1], bins=4),
        case("h3", probs=[0.5, 0.5, 0.5, 0.5], labels=[1, 0, 1, 0], bins=2),
        case("h4", probs=[0.9, 0.9, 0.9], labels=[0, 1, 1], bins=10),
        case("h5", probs=[0.25, 0.65, 0.45, 0.55], labels=[0, 1, 0, 1], bins=4),
        case("h6", probs=[0.33, 0.66, 0.99], labels=[0, 1, 1], bins=3),
    ],
    examples=["1", "3"],
    example_notes={"3": "A probability of exactly 1.0 is in the data — where does it bin?"},
)

ML = [TRIPLE_BARRIER, PURGED_KFOLD, WALK_FORWARD, FEATURES, CS_RANK, QUANTILE_SIGNAL, REGIME, STACKING, CALIBRATION]
