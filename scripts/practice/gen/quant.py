"""Quant track — ten problems."""

from common import Spec, case

SHARPE = Spec(
    slug="sharpe-ratio",
    fn="sharpe",
    statement=[
        "Implement `sharpe(returns, rf, periods)` — the annualised Sharpe ratio of a list of per-period simple returns: the mean excess return over its sample standard deviation, scaled by `sqrt(periods)`. `rf` is the ANNUAL risk-free rate; convert it to a per-period rate by dividing by `periods` before subtracting.",
        "It is the number every backtest is judged on, and the one most often quoted wrong. Use the sample standard deviation (`statistics.stdev`, n − 1 in the denominator). Return the ratio rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ len(returns) ≤ 10_000", "0 ≤ rf ≤ 0.1", "periods ∈ {12, 52, 252}", "returns are not all equal"],
    hints=[
        "Excess return per period is r − rf / periods.",
        "Annualising a per-period ratio means multiplying by the square root of the number of periods in a year.",
        "Subtract the per-period risk-free rate from every return before taking the mean — with rf = 0 nothing changes, which is why the first cases already pass.",
    ],
    ref="""
from math import sqrt
from statistics import mean, stdev

def sharpe(returns, rf, periods):
    excess = [r - rf / periods for r in returns]
    return round(mean(excess) / stdev(excess) * sqrt(periods), 4)
""",
    stub_py="""
from math import sqrt
from statistics import mean, stdev


def sharpe(returns: list, rf: float, periods: int) -> float:
    \"\"\"Annualised Sharpe ratio, rounded to 4 dp. rf is annual.\"\"\"
    # TODO: subtract the per-period risk-free rate (rf / periods) from each return
    excess = list(returns)
    return round(mean(excess) / stdev(excess) * sqrt(periods), 4)
""",
    stub_ts="""
/** Annualised Sharpe ratio, rounded to 4 dp. rf is annual. */
export function sharpe(returns: number[], rf: number, periods: number): number {
  // TODO: subtract the per-period risk-free rate (rf / periods) from each return
  const excess = [...returns];
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((a, b) => a + (b - mean) ** 2, 0) / (excess.length - 1);
  return Math.round((mean / Math.sqrt(variance)) * Math.sqrt(periods) * 1e4) / 1e4;
}
""",
    cases=[
        case("1", returns=[0.01, -0.005, 0.012, 0.003, -0.002, 0.008], rf=0.0, periods=252),
        case("2", returns=[0.02, -0.01, 0.015, 0.005, 0.0, -0.004, 0.011], rf=0.0, periods=52),
        case("3", returns=[0.01, -0.005, 0.012, 0.003, -0.002, 0.008], rf=0.05, periods=252),
        case("h1", returns=[0.03, -0.02, 0.01, 0.04, -0.01, 0.02], rf=0.0, periods=12),
        case("h2", returns=[0.004, 0.002, -0.001, 0.003, 0.005, -0.002, 0.001, 0.004], rf=0.04, periods=252),
        case("h3", returns=[-0.01, -0.02, 0.005, -0.015, 0.0], rf=0.0, periods=252),
        case("h4", returns=[0.001, 0.001, 0.002, 0.001, 0.0015], rf=0.0, periods=252),
        case("h5", returns=[0.1, -0.05, 0.08, -0.02], rf=0.0, periods=12),
        case("h6", returns=[0.006, -0.003, 0.004, 0.002, -0.001, 0.007, 0.003], rf=0.0, periods=252),
    ],
    examples=["1", "3"],
    example_notes={"3": "Same returns, 5% annual risk-free: the ratio drops because the excess return does."},
    dataset="SPY · 2020-01-02 → 2024-12-31 · 1,258 bars",
    editorial=[
        "The Sharpe ratio asks one question: how much excess return did you earn per unit of volatility? Take each period's return, subtract what cash would have paid that period, average, and divide by the standard deviation of the same excess series. The result is per period.",
        "Annualising is where the square root comes from. Means scale with time; standard deviations scale with its square root, so a ratio of the two scales with the square root of the number of periods in a year — √252 for daily data, √52 for weekly, √12 for monthly.",
        "Two ways people get it wrong. Subtracting an annual risk-free rate from daily returns (it must be divided by the period count first). And using the population standard deviation on a short sample — the statistics module's stdev divides by n − 1, and so should you.",
        "The workbench's Sharpe bot computes this on whatever tape you load and prints it beside the max drawdown, because a high Sharpe with a 40% drawdown is a strategy nobody survives long enough to collect on.",
    ],
)

ROLLING_Z = Spec(
    slug="rolling-zscore",
    fn="rolling_z",
    statement=[
        "Implement `rolling_z(values, window)` — the z-score of the LAST value relative to the trailing `window` values (inclusive of the last): `(last - mean) / stdev` using the sample standard deviation of exactly those `window` values.",
        "A z-score of −2 means today is two standard deviations below its recent self — the raw material of every mean-reversion bot in the workbench. Return the score rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ window ≤ len(values) ≤ 10_000", "the window values are not all equal"],
    hints=[
        "Slice the last `window` values first; the mean and the standard deviation come from that slice only.",
        "If you compute the statistics over the whole series, the answer is only right when the window is the whole series.",
    ],
    ref="""
from statistics import mean, stdev

def rolling_z(values, window):
    w = values[-window:]
    return round((w[-1] - mean(w)) / stdev(w), 4)
""",
    stub_py="""
from statistics import mean, stdev


def rolling_z(values: list, window: int) -> float:
    \"\"\"z-score of the last value against the trailing window, 4 dp.\"\"\"
    # TODO: only the trailing `window` values count, not the whole series
    w = values
    return round((w[-1] - mean(w)) / stdev(w), 4)
""",
    cases=[
        case("1", values=[100.0, 101.0, 99.0, 102.0, 98.0, 97.0], window=6),
        case("2", values=[10.0, 10.5, 9.8, 10.2, 11.0], window=5),
        case("3", values=[100.0, 101.0, 99.0, 102.0, 98.0, 97.0], window=3),
        case("h1", values=[50.0, 52.0, 51.0, 53.0], window=4),
        case("h2", values=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0], window=4),
        case("h3", values=[20.0, 19.5, 21.0, 20.5, 22.0, 18.0, 19.0], window=7),
        case("h4", values=[5.0, 5.1, 4.9, 5.05, 5.2, 4.8], window=6),
        case("h5", values=[300.0, 305.0, 310.0, 295.0], window=4),
        case("h6", values=[0.5, 0.6, 0.4, 0.7, 0.3], window=5),
    ],
    examples=["1", "3"],
    dataset="AMZN · 180 daily closes · seed 11",
)

HURST = Spec(
    slug="hurst-exponent",
    fn="hurst_rs",
    statement=[
        "Implement `hurst_rs(returns)` — the rescaled-range estimate of the Hurst exponent on a single window: subtract the mean from the series, cumulate the deviations, take `R = max - min` of the cumulative series and `S` the population standard deviation of the original series, and return `H = log(R / S) / log(n)`.",
        "H near 0.5 is a random walk, above it trends persist, below it they revert — the regime call the workbench's Hurst bot makes. Return `H` rounded to 4 decimal places.",
    ],
    constraints=["8 ≤ len(returns) ≤ 5_000", "S > 0"],
    hints=[
        "The range is taken over the cumulative sum of the MEAN-ADJUSTED series.",
        "If you cumulate the raw returns, the answer is only right when the series already has mean zero.",
    ],
    ref="""
from math import log
from statistics import pstdev, mean

def hurst_rs(returns):
    n = len(returns)
    m = mean(returns)
    cum = 0.0
    walk = []
    for r in returns:
        cum += r - m
        walk.append(cum)
    R = max(walk) - min(walk)
    S = pstdev(returns)
    return round(log(R / S) / log(n), 4)
""",
    stub_py="""
from math import log
from statistics import pstdev


def hurst_rs(returns: list) -> float:
    \"\"\"Rescaled-range Hurst exponent on one window, rounded to 4 dp.\"\"\"
    n = len(returns)
    cum = 0.0
    walk = []
    for r in returns:
        # TODO: subtract the series mean before cumulating
        cum += r
        walk.append(cum)
    R = max(walk) - min(walk)
    S = pstdev(returns)
    return round(log(R / S) / log(n), 4)
""",
    cases=[
        case("1", returns=[0.01, -0.01, 0.02, -0.02, 0.015, -0.015, 0.005, -0.005]),
        case("2", returns=[0.03, -0.01, -0.02, 0.01, 0.02, -0.03, 0.01, -0.01]),
        case("3", returns=[0.01, 0.02, 0.015, 0.03, 0.005, 0.01, 0.02, 0.025]),
        case("h1", returns=[0.02, -0.02, 0.01, -0.01, 0.03, -0.03, 0.005, -0.005, 0.01, -0.01]),
        case("h2", returns=[-0.01, -0.02, 0.005, -0.015, 0.0, -0.01, 0.002, -0.004]),
        case("h3", returns=[0.05, -0.05, 0.04, -0.04, 0.03, -0.03, 0.02, -0.02]),
        case("h4", returns=[0.01, 0.01, -0.01, -0.01, 0.02, -0.02, 0.015, -0.015]),
        case("h5", returns=[0.004, -0.002, -0.002, 0.006, -0.003, -0.003, 0.001, -0.001]),
        case("h6", returns=[0.1, -0.1, 0.08, -0.08, 0.06, -0.06, 0.04, -0.04, 0.02, -0.02]),
    ],
    examples=["1", "3"],
    example_notes={"3": "A trending series: every return is positive, so the mean is not zero and it matters."},
    dataset="BTC-USD · 2021-01-01 → 2024-12-31 · 1,461 bars",
)

KALMAN = Spec(
    slug="kalman-price-level",
    fn="kalman_level",
    statement=[
        "Implement `kalman_level(values, q, r)` — a one-state Kalman filter tracking a price level as a random walk: predict `x_prior = x`, `p_prior = p + q`; then correct with gain `k = p_prior / (p_prior + r)`, `x = x_prior + k·(z - x_prior)`, `p = (1 - k)·p_prior`. Start from `x = values[0]`, `p = 1.0`, and process every observation including the first.",
        "It is the smoother the workbench's Kalman bot draws over a noisy tape: `q` is how much you believe the level moves, `r` how noisy each print is. Return the list of filtered levels rounded to 4 decimal places.",
    ],
    constraints=["1 ≤ len(values) ≤ 10_000", "q ≥ 0", "r > 0"],
    hints=[
        "Two steps per observation: predict (grow the uncertainty by q) then correct (shrink it by the gain).",
        "If you forget to add q in the predict step, the filter is only right when q is zero.",
    ],
    ref="""
def kalman_level(values, q, r):
    x = values[0]
    p = 1.0
    out = []
    for z in values:
        p_prior = p + q
        k = p_prior / (p_prior + r)
        x = x + k * (z - x)
        p = (1 - k) * p_prior
        out.append(round(x, 4))
    return out
""",
    stub_py="""
def kalman_level(values: list, q: float, r: float) -> list:
    \"\"\"One-state Kalman filter of a price level. Each estimate rounded to 4 dp.\"\"\"
    x = values[0]
    p = 1.0
    out = []
    for z in values:
        # TODO: predict step — the level can drift, so the prior variance grows by q
        p_prior = p
        k = p_prior / (p_prior + r)
        x = x + k * (z - x)
        p = (1 - k) * p_prior
        out.append(round(x, 4))
    return out
""",
    cases=[
        case("1", values=[100.0, 101.0, 99.5, 102.0, 101.5], q=0.0, r=1.0),
        case("2", values=[50.0, 50.5, 51.0, 50.8], q=0.0, r=2.0),
        case("3", values=[100.0, 101.0, 99.5, 102.0, 101.5], q=0.5, r=1.0),
        case("h1", values=[10.0, 10.2, 10.1, 10.4, 10.3, 10.6], q=0.0, r=0.5),
        case("h2", values=[200.0, 202.0, 205.0, 203.0, 207.0], q=1.0, r=4.0),
        case("h3", values=[1.0, 1.0, 1.0], q=0.0, r=1.0),
        case("h4", values=[30.0, 31.0, 32.0, 33.0, 34.0], q=0.0, r=1.5),
        case("h5", values=[500.0, 498.0, 503.0, 497.0, 505.0, 499.0], q=0.0, r=3.0),
        case("h6", values=[75.0, 76.5], q=0.0, r=1.0),
    ],
    examples=["1", "3"],
    dataset="AMZN · 180 daily closes · seed 11",
)

MC_VAR = Spec(
    slug="monte-carlo-var",
    fn="mc_var",
    statement=[
        "Implement `mc_var(S, mu, sigma, days, n, seed, alpha)` — a Monte Carlo value-at-risk. Call `random.seed(seed)`, then for each of `n` paths draw one `random.gauss(0, 1)` per day and step `S·exp((mu - sigma²/2)·dt + sigma·sqrt(dt)·z)` with `dt = 1/252`, for `days` steps. VaR is the loss `S - S_T` at the `alpha` quantile: sort the losses descending and take index `int(alpha·n)`.",
        "It is the risk desk's morning number, and the workbench's Monte Carlo VaR bot. Return VaR as a fraction of `S` rounded to 4 decimal places.",
    ],
    constraints=["S > 0", "1 ≤ days ≤ 60", "100 ≤ n ≤ 20_000", "0 < alpha < 0.5"],
    hints=[
        "One path is `days` steps, each consuming one gauss draw — the draw order is what makes the seed reproducible.",
        "Simulating a single day and calling it a ten-day VaR is the classic shortcut; the horizon is a loop.",
    ],
    ref="""
import random
from math import exp, sqrt

def mc_var(S, mu, sigma, days, n, seed, alpha):
    random.seed(seed)
    dt = 1 / 252
    losses = []
    for _ in range(n):
        s = S
        for _ in range(days):
            z = random.gauss(0, 1)
            s *= exp((mu - 0.5 * sigma ** 2) * dt + sigma * sqrt(dt) * z)
        losses.append(S - s)
    losses.sort(reverse=True)
    return round(losses[int(alpha * n)] / S, 4)
""",
    stub_py="""
import random
from math import exp, sqrt


def mc_var(S: float, mu: float, sigma: float, days: int, n: int, seed: int, alpha: float) -> float:
    \"\"\"Monte Carlo VaR as a fraction of S, rounded to 4 dp.\"\"\"
    random.seed(seed)
    dt = 1 / 252
    losses = []
    for _ in range(n):
        # TODO: the horizon is `days` steps, not one
        z = random.gauss(0, 1)
        s = S * exp((mu - 0.5 * sigma ** 2) * dt + sigma * sqrt(dt) * z)
        losses.append(S - s)
    losses.sort(reverse=True)
    return round(losses[int(alpha * n)] / S, 4)
""",
    cases=[
        case("1", S=100.0, mu=0.05, sigma=0.2, days=1, n=2000, seed=7, alpha=0.05),
        case("2", S=250.0, mu=0.0, sigma=0.3, days=1, n=1000, seed=3, alpha=0.01),
        case("3", S=100.0, mu=0.05, sigma=0.2, days=10, n=2000, seed=7, alpha=0.05),
        case("h1", S=50.0, mu=0.1, sigma=0.15, days=1, n=500, seed=1, alpha=0.05),
        case("h2", S=100.0, mu=0.0, sigma=0.25, days=5, n=1000, seed=11, alpha=0.05),
        case("h3", S=1000.0, mu=0.02, sigma=0.1, days=1, n=1500, seed=5, alpha=0.1),
        case("h4", S=100.0, mu=0.05, sigma=0.4, days=1, n=800, seed=9, alpha=0.05),
        case("h5", S=75.0, mu=0.03, sigma=0.2, days=1, n=1200, seed=2, alpha=0.025),
        case("h6", S=100.0, mu=0.0, sigma=0.35, days=1, n=1000, seed=4, alpha=0.05),
    ],
    examples=["1", "3"],
    dataset="AMZN · seed tape · 2,000 paths",
)

BOLLINGER = Spec(
    slug="bollinger-bands",
    fn="bollinger",
    statement=[
        "Implement `bollinger(values, window, k)` — the Bollinger bands at the last bar: the simple moving average of the trailing `window` values, and `k` population standard deviations either side of it.",
        "The bands are the most-drawn overlay on the /pro chart and the envelope the workbench's Bollinger bot trades. Return `[lower, middle, upper]` rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ window ≤ len(values)", "0.5 ≤ k ≤ 4"],
    hints=[
        "Middle is the mean of the last `window` values; the width is k times their population standard deviation.",
        "k is a parameter — two is the textbook default, not a constant.",
    ],
    ref="""
from statistics import mean, pstdev

def bollinger(values, window, k):
    w = values[-window:]
    m = mean(w)
    s = pstdev(w)
    return [round(m - k * s, 4), round(m, 4), round(m + k * s, 4)]
""",
    stub_py="""
from statistics import mean, pstdev


def bollinger(values: list, window: int, k: float) -> list:
    \"\"\"[lower, middle, upper] at the last bar, rounded to 4 dp.\"\"\"
    w = values[-window:]
    m = mean(w)
    s = pstdev(w)
    # TODO: the band width is k standard deviations — k is a parameter, not always 2
    return [round(m - 2 * s, 4), round(m, 4), round(m + 2 * s, 4)]
""",
    cases=[
        case("1", values=[100.0, 102.0, 101.0, 103.0, 104.0, 102.5], window=5, k=2.0),
        case("2", values=[50.0, 49.0, 51.0, 50.5, 52.0, 51.5, 50.0], window=7, k=2.0),
        case("3", values=[100.0, 102.0, 101.0, 103.0, 104.0, 102.5], window=5, k=1.5),
        case("h1", values=[10.0, 10.2, 9.8, 10.1], window=4, k=2.0),
        case("h2", values=[20.0, 21.0, 22.0, 21.5, 23.0, 22.5], window=6, k=2.5),
        case("h3", values=[300.0, 305.0, 295.0, 300.0, 310.0], window=5, k=2.0),
        case("h4", values=[1.0, 1.1, 0.9, 1.05, 0.95, 1.0], window=3, k=2.0),
        case("h5", values=[75.0, 75.0, 75.0, 75.0], window=4, k=2.0),
        case("h6", values=[1000.0, 1010.0, 990.0, 1005.0, 995.0, 1002.0, 998.0], window=6, k=2.0),
    ],
    examples=["1", "3"],
)

HALF_LIFE = Spec(
    slug="mean-reversion-half-life",
    fn="half_life",
    statement=[
        "Implement `half_life(spread)` — the mean-reversion half-life of a spread series. Regress `Δs_t = s_t - s_{t-1}` on `s_{t-1}` with an intercept by ordinary least squares to get the slope `b`. If `b < 0` the spread reverts and the half-life is `-ln(2) / ln(1 + b)`; if `b >= 0` it does not revert, and there is no half-life — return `None`.",
        "Half-life tells a pairs trader how long a divergence should take to close. Return it rounded to 4 decimal places.",
    ],
    constraints=["4 ≤ len(spread) ≤ 5_000", "spread is not constant"],
    hints=[
        "OLS slope with intercept: covariance of (lagged spread, change) over the variance of the lagged spread.",
        "A slope at or above zero means the spread is not pulling back — that case has no half-life, return None.",
    ],
    ref="""
from math import log

def half_life(spread):
    x = spread[:-1]
    y = [b - a for a, b in zip(spread[:-1], spread[1:])]
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    sxx = sum((xi - mx) ** 2 for xi in x)
    sxy = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    b = sxy / sxx
    if b >= 0:
        return None
    return round(-log(2) / log(1 + b), 4)
""",
    stub_py="""
from math import log


def half_life(spread: list):
    \"\"\"Half-life of mean reversion in periods (4 dp), or None if it does not revert.\"\"\"
    x = spread[:-1]
    y = [b - a for a, b in zip(spread[:-1], spread[1:])]
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    sxx = sum((xi - mx) ** 2 for xi in x)
    sxy = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    b = sxy / sxx
    # TODO: a spread that does not revert (b >= 0) has no half-life
    return round(-log(2) / log(1 + b), 4)
""",
    cases=[
        case("1", spread=[1.0, 0.6, 0.3, 0.2, 0.1, 0.05, 0.02]),
        case("2", spread=[2.0, 1.3, 0.85, 0.55, 0.36, 0.23]),
        case("3", spread=[1.0, 1.1, 1.25, 1.4, 1.6, 1.85]),
        case("h1", spread=[-3.0, -2.0, -1.4, -0.9, -0.6, -0.4, -0.25]),
        case("h2", spread=[0.5, 0.7, 0.95, 1.3, 1.7, 2.2, 2.8]),
        case("h3", spread=[5.0, 3.5, 2.4, 1.7, 1.2, 0.85]),
        case("h4", spread=[0.2, 0.14, 0.1, 0.07, 0.05, 0.035]),
        case("h5", spread=[10.0, 8.0, 6.5, 5.2, 4.1, 3.3, 2.7]),
        case("h6", spread=[1.5, 1.0, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12]),
    ],
    examples=["1", "3"],
    example_notes={"3": "A diverging spread — no half-life."},
)

PAIRS = Spec(
    slug="pairs-cointegration",
    fn="pairs_spread",
    statement=[
        "Implement `pairs_spread(x, y)` — the first step of a pairs trade: regress `y` on `x` with an intercept by ordinary least squares to get the hedge ratio `beta`, then measure the residual spread `y - a - beta·x`. Return `[beta, spread_std]` where `spread_std` is the population standard deviation of the residuals.",
        "The hedge ratio sizes the two legs; the residual's spread is what you trade around. Return both rounded to 4 decimal places.",
    ],
    constraints=["3 ≤ len(x) == len(y) ≤ 5_000", "x is not constant"],
    hints=[
        "With an intercept, beta is cov(x, y) / var(x) — computed on demeaned series.",
        "A regression through the origin only agrees when x happens to have mean zero.",
    ],
    ref="""
from statistics import pstdev

def pairs_spread(x, y):
    n = len(x)
    mx = sum(x) / n
    my = sum(y) / n
    sxx = sum((xi - mx) ** 2 for xi in x)
    sxy = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    beta = sxy / sxx
    a = my - beta * mx
    resid = [yi - a - beta * xi for xi, yi in zip(x, y)]
    return [round(beta, 4), round(pstdev(resid), 4)]
""",
    stub_py="""
from statistics import pstdev


def pairs_spread(x: list, y: list) -> list:
    \"\"\"[hedge ratio, residual spread std], both rounded to 4 dp.\"\"\"
    # TODO: fit an intercept — this regression runs through the origin
    beta = sum(xi * yi for xi, yi in zip(x, y)) / sum(xi * xi for xi in x)
    resid = [yi - beta * xi for xi, yi in zip(x, y)]
    return [round(beta, 4), round(pstdev(resid), 4)]
""",
    cases=[
        case("1", x=[-2.0, -1.0, 0.0, 1.0, 2.0], y=[1.0, 2.5, 4.0, 5.5, 7.5]),
        case("2", x=[-3.0, -1.0, 1.0, 3.0], y=[10.0, 11.0, 13.0, 14.0]),
        case("3", x=[10.0, 11.0, 12.0, 13.0, 14.0], y=[21.0, 22.5, 24.0, 25.5, 27.5]),
        case("h1", x=[-1.5, -0.5, 0.5, 1.5], y=[0.0, 1.0, 1.8, 3.2]),
        case("h2", x=[100.0, 101.0, 103.0, 102.0, 105.0], y=[201.0, 203.5, 206.0, 204.8, 211.0]),
        case("h3", x=[-4.0, -2.0, 0.0, 2.0, 4.0], y=[-8.0, -4.5, 0.0, 4.5, 8.0]),
        case("h4", x=[-1.0, 0.0, 1.0], y=[5.0, 5.0, 5.0]),
        case("h5", x=[-2.0, -1.0, 0.0, 1.0, 2.0], y=[3.0, 2.0, 4.0, 3.0, 5.0]),
        case("h6", x=[-6.0, -2.0, 2.0, 6.0], y=[1.0, 3.0, 4.0, 7.0]),
    ],
    examples=["1", "3"],
)

HESTON = Spec(
    slug="heston-monte-carlo",
    fn="heston_call",
    statement=[
        "Implement `heston_call(S, K, T, r, v0, kappa, theta, xi, rho, steps, n, seed)` — a European call under Heston stochastic volatility by Euler simulation with full truncation. Call `random.seed(seed)`; for each path and step draw `z1 = random.gauss(0, 1)` then `w = random.gauss(0, 1)`, set `z2 = rho·z1 + sqrt(1 - rho²)·w`, update `v = max(v + kappa·(theta - v)·dt + xi·sqrt(max(v, 0))·sqrt(dt)·z2, 0)` and `S = S·exp((r - v/2)·dt + sqrt(v)·sqrt(dt)·z1)` using the variance from the START of the step. Discount the mean payoff.",
        "Five parameters and a correlation buy you a volatility smile that Black-Scholes cannot draw; the workbench's Heston surrogate is trained on this exact simulation. Return the price rounded to 4 decimal places.",
    ],
    constraints=["-1 < rho < 1", "kappa, theta, xi > 0", "steps ≤ 40, n ≤ 1_000 (it has to run in your head, not on a cluster)"],
    hints=[
        "Two draws per step, in a fixed order — that is what makes the seed reproducible.",
        "Correlate the second draw: rho times the first plus sqrt(1 − rho²) times the second. With rho = 0 that is the same as ignoring it.",
    ],
    ref="""
import random
from math import exp, sqrt

def heston_call(S, K, T, r, v0, kappa, theta, xi, rho, steps, n, seed):
    random.seed(seed)
    dt = T / steps
    total = 0.0
    for _ in range(n):
        s, v = S, v0
        for _ in range(steps):
            z1 = random.gauss(0, 1)
            w = random.gauss(0, 1)
            z2 = rho * z1 + sqrt(1 - rho * rho) * w
            v_pos = max(v, 0.0)
            s = s * exp((r - v_pos / 2) * dt + sqrt(v_pos) * sqrt(dt) * z1)
            v = max(v + kappa * (theta - v) * dt + xi * sqrt(v_pos) * sqrt(dt) * z2, 0.0)
        total += max(s - K, 0.0)
    return round(exp(-r * T) * total / n, 4)
""",
    stub_py="""
import random
from math import exp, sqrt


def heston_call(S, K, T, r, v0, kappa, theta, xi, rho, steps, n, seed):
    \"\"\"Heston call by Euler Monte Carlo, rounded to 4 dp.\"\"\"
    random.seed(seed)
    dt = T / steps
    total = 0.0
    for _ in range(n):
        s, v = S, v0
        for _ in range(steps):
            z1 = random.gauss(0, 1)
            w = random.gauss(0, 1)
            # TODO: the variance shock is correlated with the price shock through rho
            z2 = w
            v_pos = max(v, 0.0)
            s = s * exp((r - v_pos / 2) * dt + sqrt(v_pos) * sqrt(dt) * z1)
            v = max(v + kappa * (theta - v) * dt + xi * sqrt(v_pos) * sqrt(dt) * z2, 0.0)
        total += max(s - K, 0.0)
    return round(exp(-r * T) * total / n, 4)
""",
    cases=[
        case("1", S=100.0, K=100.0, T=1.0, r=0.02, v0=0.04, kappa=1.5, theta=0.04, xi=0.3, rho=0.0, steps=20, n=400, seed=7),
        case("2", S=100.0, K=110.0, T=0.5, r=0.0, v0=0.09, kappa=2.0, theta=0.06, xi=0.4, rho=0.0, steps=20, n=300, seed=3),
        case("3", S=100.0, K=100.0, T=1.0, r=0.02, v0=0.04, kappa=1.5, theta=0.04, xi=0.3, rho=-0.7, steps=20, n=400, seed=7),
        case("h1", S=50.0, K=45.0, T=1.0, r=0.01, v0=0.05, kappa=1.0, theta=0.05, xi=0.2, rho=0.0, steps=20, n=300, seed=1),
        case("h2", S=100.0, K=95.0, T=0.25, r=0.03, v0=0.03, kappa=3.0, theta=0.03, xi=0.5, rho=-0.5, steps=20, n=400, seed=11),
        case("h3", S=200.0, K=200.0, T=1.0, r=0.0, v0=0.02, kappa=1.0, theta=0.02, xi=0.1, rho=0.0, steps=20, n=300, seed=5),
        case("h4", S=100.0, K=120.0, T=2.0, r=0.02, v0=0.06, kappa=1.2, theta=0.05, xi=0.3, rho=0.0, steps=30, n=300, seed=9),
        case("h5", S=80.0, K=80.0, T=0.5, r=0.0, v0=0.16, kappa=2.5, theta=0.1, xi=0.6, rho=0.0, steps=20, n=300, seed=2),
        case("h6", S=100.0, K=90.0, T=1.0, r=0.04, v0=0.04, kappa=1.5, theta=0.04, xi=0.3, rho=0.0, steps=20, n=400, seed=4),
    ],
    examples=["1", "3"],
    example_notes={"3": "Same parameters with rho = −0.7: the skew appears."},
)

LINREG = Spec(
    slug="linreg-channel",
    fn="linreg_channel",
    statement=[
        "Implement `linreg_channel(values, k)` — a linear-regression channel over the whole series: fit `y = a + b·t` for `t = 0..n-1` by ordinary least squares, take the population standard deviation of the RESIDUALS `y - (a + b·t)`, and return the channel at the last bar: `[slope, fitted_last - k·std, fitted_last + k·std]`.",
        "It is the channel the workbench's regression bot draws and the /pro chart lets you drag. Return the three values rounded to 4 decimal places.",
    ],
    constraints=["3 ≤ len(values) ≤ 5_000", "0.5 ≤ k ≤ 4"],
    hints=[
        "Fit first, then measure the scatter around the fitted line — not around the mean of the prices.",
        "For a flat series the two agree, which is why a trending series is the one that exposes the difference.",
    ],
    ref="""
from statistics import pstdev

def linreg_channel(values, k):
    n = len(values)
    t = list(range(n))
    mt = sum(t) / n
    my = sum(values) / n
    stt = sum((ti - mt) ** 2 for ti in t)
    sty = sum((ti - mt) * (yi - my) for ti, yi in zip(t, values))
    b = sty / stt
    a = my - b * mt
    resid = [yi - (a + b * ti) for ti, yi in zip(t, values)]
    s = pstdev(resid)
    last = a + b * (n - 1)
    return [round(b, 4), round(last - k * s, 4), round(last + k * s, 4)]
""",
    stub_py="""
from statistics import pstdev


def linreg_channel(values: list, k: float) -> list:
    \"\"\"[slope, lower, upper] at the last bar, rounded to 4 dp.\"\"\"
    n = len(values)
    t = list(range(n))
    mt = sum(t) / n
    my = sum(values) / n
    stt = sum((ti - mt) ** 2 for ti in t)
    sty = sum((ti - mt) * (yi - my) for ti, yi in zip(t, values))
    b = sty / stt
    a = my - b * mt
    # TODO: the channel width is the scatter around the FITTED line, not around the mean
    s = pstdev(values)
    last = a + b * (n - 1)
    return [round(b, 4), round(last - k * s, 4), round(last + k * s, 4)]
""",
    cases=[
        case("1", values=[100.0, 102.0, 98.0, 98.0, 102.0, 100.0], k=2.0),
        case("2", values=[50.0, 51.0, 49.0, 50.0, 49.0, 51.0, 50.0], k=1.5),
        case("3", values=[100.0, 101.0, 103.0, 102.0, 105.0, 106.0], k=2.0),
        case("h1", values=[10.0, 10.5, 10.5, 10.0], k=2.0),
        case("h2", values=[20.0, 22.0, 23.5, 25.0, 27.0], k=2.0),
        case("h3", values=[5.0, 5.0, 5.0, 5.0, 5.0], k=2.0),
        case("h4", values=[300.0, 310.0, 310.0, 300.0], k=1.0),
        case("h5", values=[1.0, 1.2, 0.8, 1.0, 0.8, 1.2, 1.0], k=2.0),
        case("h6", values=[75.0, 76.0, 76.0, 75.0], k=2.5),
    ],
    examples=["1", "3"],
)

QUANT = [SHARPE, ROLLING_Z, HURST, KALMAN, MC_VAR, BOLLINGER, HALF_LIFE, PAIRS, HESTON, LINREG]
